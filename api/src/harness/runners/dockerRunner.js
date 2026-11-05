import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { runInContainer, buildImageFromDockerfile } from "../codeSandbox.js";
import { getActiveTaskContent } from "../taskVariant.js";
import { ensureEgressNetwork } from "../egressProxy.js";

// Agent One's own "docker task contract" — there's no existing standard for
// this the way there is for http/mcp. The container reads /task/input.json
// and is expected to write /task/output.json with { output, tokens?,
// cost_usd? }; stdout lines become message events in the trace, the same
// shape httpRunner/mcpRunner produce, so grading never needs to know which
// runner ran.
//
// Builds are cached per (endpoint, buildMode, runtimeConfig) for the process
// lifetime — one EvalRun's many task runs (3x per task) should build the
// image once, not once per task run. Keying on endpoint alone (pre-Phase C)
// would wrongly share a cached image between two fast-path submissions of
// the same repo with different runtimeConfig.
const buildCache = new Map();

function buildCacheKey(manifest) {
  const { endpoint, buildMode = "direct", runtimeConfig = {} } = manifest.interface;
  return crypto.createHash("sha256").update(JSON.stringify({ endpoint, buildMode, runtimeConfig })).digest("hex");
}

// Restricting build sources is a real (if partial) SSRF/supply-chain
// mitigation: only a real GitHub repo, or — for local fixture testing only —
// a file:// path gated behind the same dev-only flag safeFetch uses for
// loopback endpoints. A malicious Dockerfile can still try to exfiltrate
// during the build step itself (before --network none applies at run time);
// mitigated by the egressProxy.js "build-registries" allowlist, not solved
// outright.
function isAllowedBuildSource(endpoint) {
  if (endpoint.startsWith("https://github.com/")) return true;
  if (endpoint.startsWith("file://") && process.env.ALLOW_LOOPBACK_ENDPOINTS === "true") return true;
  return false;
}

// Strict on purpose: this string gets interpolated into a generated
// Dockerfile's `git clone` line (buildMode "generated"). Only a bare
// https://github.com/<owner>/<repo>(.git)? is accepted — no shell
// metacharacters, no query strings, no other host, so there's no way for
// a submitted URL to break out of that single RUN instruction.
export function isValidGithubRepoUrl(url) {
  return typeof url === "string" && /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(\.git)?\/?$/.test(url);
}

// Fast-path commands are free-form shell (the whole point is running
// whatever install/entry command the user's own repo needs), so metacharacters
// are allowed — the only hard requirement is staying on one line, since a
// literal newline would let the string spill into a second Dockerfile
// instruction.
function isValidShellCommandLine(cmd) {
  return typeof cmd === "string" && cmd.length > 0 && cmd.length <= 1000 && !/[\r\n]/.test(cmd);
}

const RUNTIME_PRESETS = {
  python: {
    baseImage: "python:3.12-slim",
    shimFilename: "shim.py",
    entrypoint: ["python3", "/app/shim.py"],
    // Downloads the archive with the base image's own stdlib — no apt-get,
    // no git. apt-get would need a Debian package mirror the egress
    // proxy's allowlist deliberately doesn't carry (see Phase A); this
    // way the build never needs the proxy for anything beyond what's
    // already allowlisted for pip (github.com/codeload.github.com cover
    // both).
    fetchCommand: (archiveUrl) =>
      `python3 -c "import urllib.request; urllib.request.urlretrieve('${archiveUrl}', '/tmp/repo.tar.gz')"`,
    shimContent: `import json, os, subprocess

def main():
    with open("/task/input.json") as f:
        task = json.load(f)
    input_text = task.get("input", "")

    with open("/app/runtime_config.json") as f:
        config = json.load(f)
    input_mode = config.get("inputMode", "stdin")
    output_mode = config.get("outputMode", "stdout")
    entry_command = config.get("entryCommand", "")

    env = os.environ.copy()
    stdin_data = None

    if input_mode == "stdin":
        stdin_data = input_text
    elif input_mode == "file":
        with open("/tmp/agentone_input.txt", "w") as f:
            f.write(input_text)
        env["AGENTONE_INPUT_FILE"] = "/tmp/agentone_input.txt"
    elif input_mode == "env_var":
        env["AGENTONE_INPUT"] = input_text

    if output_mode == "file":
        env["AGENTONE_OUTPUT_FILE"] = "/tmp/agentone_output.txt"

    result = subprocess.run(
        entry_command, shell=True, cwd="/app/repo",
        input=stdin_data, capture_output=True, text=True, env=env, timeout=250,
    )

    output = result.stdout
    if output_mode == "file" and os.path.exists("/tmp/agentone_output.txt"):
        with open("/tmp/agentone_output.txt") as f:
            output = f.read()

    with open("/task/output.json", "w") as f:
        json.dump({"output": output, "tokens": 0, "cost_usd": 0}, f)

if __name__ == "__main__":
    main()
`,
  },
  node: {
    baseImage: "node:20-slim",
    shimFilename: "shim.js",
    entrypoint: ["node", "/app/shim.js"],
    // https.get doesn't follow redirects itself (unlike Python's
    // urlretrieve) — github.com's archive URL 302s to codeload.github.com,
    // so that's handled by hand, one hop.
    fetchCommand: (archiveUrl) =>
      `node -e "const https=require('https');const fs=require('fs');function fetchUrl(url){https.get(url,(res)=>{if(res.statusCode>=300&&res.statusCode<400&&res.headers.location){fetchUrl(res.headers.location);return;}const file=fs.createWriteStream('/tmp/repo.tar.gz');res.pipe(file);file.on('finish',()=>file.close());});}fetchUrl('${archiveUrl}');"`,
    shimContent: `const fs = require("fs");
const { execSync } = require("child_process");

function main() {
  const task = JSON.parse(fs.readFileSync("/task/input.json", "utf-8"));
  const inputText = task.input || "";

  const config = JSON.parse(fs.readFileSync("/app/runtime_config.json", "utf-8"));
  const inputMode = config.inputMode || "stdin";
  const outputMode = config.outputMode || "stdout";
  const entryCommand = config.entryCommand || "";

  const env = { ...process.env };
  let stdinData;

  if (inputMode === "stdin") {
    stdinData = inputText;
  } else if (inputMode === "file") {
    fs.writeFileSync("/tmp/agentone_input.txt", inputText);
    env.AGENTONE_INPUT_FILE = "/tmp/agentone_input.txt";
  } else if (inputMode === "env_var") {
    env.AGENTONE_INPUT = inputText;
  }

  if (outputMode === "file") {
    env.AGENTONE_OUTPUT_FILE = "/tmp/agentone_output.txt";
  }

  let stdout = "";
  try {
    stdout = execSync(entryCommand, {
      cwd: "/app/repo", input: stdinData, env, timeout: 250000, encoding: "utf-8",
    });
  } catch (err) {
    stdout = err.stdout ? err.stdout.toString() : "";
  }

  let output = stdout;
  if (outputMode === "file" && fs.existsSync("/tmp/agentone_output.txt")) {
    output = fs.readFileSync("/tmp/agentone_output.txt", "utf-8");
  }

  fs.writeFileSync("/task/output.json", JSON.stringify({ output, tokens: 0, cost_usd: 0 }));
}

main();
`,
  },
};

// Builds the throwaway context dir for a "generated" (fast-path) build: a
// Dockerfile that clones the validated repo URL internally, the install
// command the user gave, and a shim that bridges Agent One's
// input.json/output.json contract to the user's own entry command.
// entryCommand/inputMode/outputMode are baked into the image via
// runtime_config.json (part of the cache key already) — credentials are
// never written here; those are injected at `docker run` time via
// runInContainer's `env` param instead, so they never land in an image layer.
function writeGeneratedBuildContext(repoUrl, runtimeConfig) {
  if (!isValidGithubRepoUrl(repoUrl)) {
    throw new Error(`Fast-path repo URL must be https://github.com/<owner>/<repo>: ${repoUrl}`);
  }
  const { runtime, installCommand = "", entryCommand, inputMode = "stdin", outputMode = "stdout" } = runtimeConfig || {};
  const preset = RUNTIME_PRESETS[runtime];
  if (!preset) {
    throw new Error(`Unsupported fast-path runtime "${runtime}" — must be one of: ${Object.keys(RUNTIME_PRESETS).join(", ")}.`);
  }
  if (installCommand && !isValidShellCommandLine(installCommand)) {
    throw new Error("installCommand must be a single line (no newlines) under 1000 characters.");
  }
  if (!isValidShellCommandLine(entryCommand)) {
    throw new Error("entryCommand is required and must be a single line (no newlines) under 1000 characters.");
  }
  if (!["stdin", "file", "env_var"].includes(inputMode)) {
    throw new Error(`inputMode must be one of: stdin, file, env_var.`);
  }
  if (!["stdout", "file"].includes(outputMode)) {
    throw new Error(`outputMode must be one of: stdout, file.`);
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "agentone-generated-build-"));

  // archive/HEAD.tar.gz is GitHub's own "give me the default branch's tip,
  // whatever it's called" URL — avoids needing to know/ask for main vs.
  // master. github.com (and the codeload.github.com it redirects to) are
  // both already allowlisted for the pip/npm VCS-install case, so this
  // needs nothing new from the egress proxy.
  const archiveUrl = `${repoUrl.replace(/\.git\/?$/, "").replace(/\/$/, "")}/archive/HEAD.tar.gz`;

  const dockerfileLines = [
    `FROM ${preset.baseImage}`,
    `WORKDIR /app`,
    `RUN ${preset.fetchCommand(archiveUrl)}`,
    `RUN mkdir -p /app/repo && tar xzf /tmp/repo.tar.gz -C /app/repo --strip-components=1 && rm /tmp/repo.tar.gz`,
    `WORKDIR /app/repo`,
  ];
  if (installCommand) dockerfileLines.push(`RUN ${installCommand}`);
  dockerfileLines.push(
    `COPY ${preset.shimFilename} /app/${preset.shimFilename}`,
    `COPY runtime_config.json /app/runtime_config.json`,
    `ENTRYPOINT ${JSON.stringify(preset.entrypoint)}`,
  );

  fs.writeFileSync(path.join(dir, "Dockerfile"), dockerfileLines.join("\n") + "\n");
  fs.writeFileSync(path.join(dir, preset.shimFilename), preset.shimContent);
  fs.writeFileSync(path.join(dir, "runtime_config.json"), JSON.stringify({ entryCommand, inputMode, outputMode }));

  return dir;
}

// Wires manifest.permissions.network (schema field existed since Phase 2,
// read by nothing until now) into the actual sandbox boundary. "none"
// (default) changes nothing for any existing listing. "allowlist" joins
// the same --internal/no-route-out network + squid topology egressProxy.js
// already uses for builds — the proxy env vars are a convenience for
// well-behaved HTTP clients (most SDKs honor them); a client that ignores
// them simply has nowhere to route to, since the network itself has no
// path to the internet. "open" is deliberately never implemented — kept
// in the schema only as a documented non-capability.
async function resolveRuntimeNetwork(manifest) {
  const permission = manifest.permissions?.network || "none";
  if (permission === "none") return { network: "none", env: {} };
  if (permission === "open") {
    throw new Error('manifest.permissions.network "open" is not a supported capability — only "none" or "allowlist" are implemented.');
  }
  const { network, proxyHost, proxyPort } = await ensureEgressNetwork("llm-providers");
  const proxyUrl = `http://${proxyHost}:${proxyPort}`;
  return {
    network,
    env: { HTTP_PROXY: proxyUrl, HTTPS_PROXY: proxyUrl, http_proxy: proxyUrl, https_proxy: proxyUrl },
  };
}

async function ensureImage(manifest) {
  const cacheKey = buildCacheKey(manifest);
  if (buildCache.has(cacheKey)) return buildCache.get(cacheKey);

  const { endpoint, buildMode = "direct", runtimeConfig = {} } = manifest.interface;
  const tag = `agentone-docker-agent-${crypto.randomBytes(6).toString("hex")}`;

  if (buildMode === "generated") {
    const buildContextDir = writeGeneratedBuildContext(endpoint, runtimeConfig);
    try {
      await buildImageFromDockerfile(buildContextDir, tag, { network: "build-registries" });
    } finally {
      fs.rmSync(buildContextDir, { recursive: true, force: true });
    }
  } else {
    if (!isAllowedBuildSource(endpoint)) {
      throw new Error(
        `Docker build source must be https://github.com/... (or file:// with ALLOW_LOOPBACK_ENDPOINTS=true for local testing): ${endpoint}`
      );
    }
    const buildContext = endpoint.startsWith("file://") ? endpoint.slice("file://".length) : endpoint;
    // "build-registries": the build gets just enough network (via an
    // allowlisting proxy on a no-route-out internal network) for
    // pip/npm/apt to fetch dependencies — not open internet. Closes a real
    // gap: an untrusted Dockerfile's RUN steps used to have unrestricted
    // network access during build, before --network none ever applied.
    await buildImageFromDockerfile(buildContext, tag, { network: "build-registries" }); // docker build accepts a git URL as context directly
  }

  buildCache.set(cacheKey, tag);
  return tag;
}

export async function runDockerTask({ manifest, task, envOverrides = {} }) {
  const started = Date.now();
  const { input, fixtures } = getActiveTaskContent(task);
  const events = [];
  let tmpDir;

  try {
    const tag = await ensureImage(manifest);
    const { network: runtimeNetwork, env: proxyEnv } = await resolveRuntimeNetwork(manifest);

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentone-task-"));
    fs.writeFileSync(path.join(tmpDir, "input.json"), JSON.stringify({ input, fixtures }));

    events.push({ type: "step", timestamp: new Date(), tokens: 0, data: { note: "running container" } });

    const result = await runInContainer({
      image: tag,
      command: [],
      mounts: [{ hostPath: tmpDir, containerPath: "/task", readOnly: false }],
      timeoutS: task.budget?.timeoutS || 60,
      network: runtimeNetwork,
      // Pasted/demo credentials (envOverrides) are allowed to override a
      // proxy var in the unlikely case a submission sets its own — order
      // here is deliberate, not incidental.
      env: { ...proxyEnv, ...envOverrides },
    });

    for (const line of result.stdout.split("\n").filter(Boolean)) {
      events.push({ type: "message", timestamp: new Date(), tokens: 0, data: { text: line } });
    }

    let finalOutput = "";
    let tokens = 0;
    let costUsd = 0;
    const outputPath = path.join(tmpDir, "output.json");
    if (fs.existsSync(outputPath)) {
      const out = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
      finalOutput = out.output || "";
      tokens = out.tokens || 0;
      costUsd = out.cost_usd || 0;
      events.push({ type: "final", timestamp: new Date(), tokens, data: { output: finalOutput } });
    }

    if (result.timedOut) {
      return {
        events, finalOutput: "", tokens, costUsd, latencyMs: Date.now() - started,
        outcome: "error", errorMessage: `Container exceeded its ${task.budget?.timeoutS || 60}s timeout and was killed.`,
      };
    }
    if (!finalOutput) {
      return {
        events, finalOutput: "", tokens, costUsd, latencyMs: Date.now() - started,
        outcome: "error", errorMessage: `Container exited (code ${result.exitCode}) without writing output.json. stderr: ${result.stderr.slice(-500)}`,
      };
    }

    return { events, finalOutput, tokens, costUsd, latencyMs: Date.now() - started, outcome: "ok", errorMessage: "" };
  } catch (err) {
    return { events, finalOutput: "", tokens: 0, costUsd: 0, latencyMs: Date.now() - started, outcome: "error", errorMessage: err.message };
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
