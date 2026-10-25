import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { runInContainer, buildImageFromDockerfile } from "../codeSandbox.js";
import { getActiveTaskContent } from "../taskVariant.js";

// Agent One's own "docker task contract" — there's no existing standard for
// this the way there is for http/mcp. The container reads /task/input.json
// and is expected to write /task/output.json with { output, tokens?,
// cost_usd? }; stdout lines become message events in the trace, the same
// shape httpRunner/mcpRunner produce, so grading never needs to know which
// runner ran.
//
// Builds are cached per manifest endpoint for the process lifetime — one
// EvalRun's many task runs (3x per task) should build the image once, not
// once per task run.
const buildCache = new Map();

// Restricting build sources is a real (if partial) SSRF/supply-chain
// mitigation: only a real GitHub repo, or — for local fixture testing only —
// a file:// path gated behind the same dev-only flag safeFetch uses for
// loopback endpoints. A malicious Dockerfile can still try to exfiltrate
// during the build step itself (before --network none applies at run time);
// documented in the Phase 4 plan as a real follow-up, not solved here.
function isAllowedBuildSource(endpoint) {
  if (endpoint.startsWith("https://github.com/")) return true;
  if (endpoint.startsWith("file://") && process.env.ALLOW_LOOPBACK_ENDPOINTS === "true") return true;
  return false;
}

async function ensureImage(manifest) {
  const endpoint = manifest.interface.endpoint;
  if (buildCache.has(endpoint)) return buildCache.get(endpoint);
  if (!isAllowedBuildSource(endpoint)) {
    throw new Error(
      `Docker build source must be https://github.com/... (or file:// with ALLOW_LOOPBACK_ENDPOINTS=true for local testing): ${endpoint}`
    );
  }
  const tag = `agentone-docker-agent-${crypto.randomBytes(6).toString("hex")}`;
  const buildContext = endpoint.startsWith("file://") ? endpoint.slice("file://".length) : endpoint;
  await buildImageFromDockerfile(buildContext, tag); // docker build accepts a git URL as context directly
  buildCache.set(endpoint, tag);
  return tag;
}

export async function runDockerTask({ manifest, task }) {
  const started = Date.now();
  const { input, fixtures } = getActiveTaskContent(task);
  const events = [];
  let tmpDir;

  try {
    const tag = await ensureImage(manifest);

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentone-task-"));
    fs.writeFileSync(path.join(tmpDir, "input.json"), JSON.stringify({ input, fixtures }));

    events.push({ type: "step", timestamp: new Date(), tokens: 0, data: { note: "running container" } });

    const result = await runInContainer({
      image: tag,
      command: [],
      mounts: [{ hostPath: tmpDir, containerPath: "/task", readOnly: false }],
      timeoutS: task.budget?.timeoutS || 60,
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
