import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = (cmd, args) => new Promise((resolve, reject) => {
  execFile(cmd, args, (error, stdout, stderr) => {
    if (error) reject(Object.assign(error, { stdout, stderr }));
    else resolve({ stdout, stderr });
  });
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQUID_IMAGE_TAG = "agentone-egress-squid:latest";
const SQUID_DOCKERFILE_DIR = path.join(__dirname, "squid");

// Each profile is a standing, reused-across-runs allowlist — never created
// per-run. The internal network has NO route to the internet at all
// (`--internal`); only the profile's own squid container bridges onto both
// it and the one real-egress network, so the boundary holds even against
// code that ignores HTTP_PROXY/HTTPS_PROXY and opens a raw socket — there's
// simply nowhere for that socket to go. A proxy env var is still set for
// well-behaved tooling (pip/npm do respect it), but it's a convenience, not
// the actual security boundary.
const EXTERNAL_NETWORK = "agentone-net-external";

const PROFILES = {
  // Phase A: just enough for `pip install`/`npm install` during a Docker
  // build. Nothing else — never widen this to arbitrary registries.
  "build-registries": {
    internalNetwork: "agentone-net-build-registries",
    proxyContainer: "agentone-proxy-build-registries",
    allowedHosts: [
      "pypi.org", "files.pythonhosted.org",
      "registry.npmjs.org",
      "github.com", "codeload.github.com", "objects.githubusercontent.com",
    ],
  },
  // Phase D: the only hosts a sandboxed agent may ever reach at run time —
  // the LLM providers this app actually supports. Never add a general
  // "allow anything" profile; that would reintroduce full SSRF risk.
  "llm-providers": {
    internalNetwork: "agentone-net-llm-providers",
    proxyContainer: "agentone-proxy-llm-providers",
    allowedHosts: ["api.groq.com", "generativelanguage.googleapis.com"],
  },
};

async function networkExists(name) {
  try {
    await execFileAsync("docker", ["network", "inspect", name]);
    return true;
  } catch {
    return false;
  }
}

async function containerIsRunning(name) {
  try {
    const { stdout } = await execFileAsync("docker", ["inspect", "-f", "{{.State.Running}}", name]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

async function imageExists(tag) {
  try {
    await execFileAsync("docker", ["image", "inspect", tag]);
    return true;
  } catch {
    return false;
  }
}

async function ensureSquidImage() {
  if (await imageExists(SQUID_IMAGE_TAG)) return;
  await execFileAsync("docker", ["build", "-t", SQUID_IMAGE_TAG, SQUID_DOCKERFILE_DIR]);
}

function buildSquidConf(allowedHosts) {
  return [
    "http_port 3128",
    `acl allowed_dst dstdomain ${allowedHosts.join(" ")}`,
    "acl SSL_ports port 443",
    "acl CONNECT method CONNECT",
    "http_access deny CONNECT !SSL_ports",
    "http_access allow CONNECT allowed_dst",
    "http_access allow allowed_dst",
    "http_access deny all",
    "",
  ].join("\n");
}

// Idempotent: safe to call before every build/run. Creates the shared
// external network, the profile's internal (no-route-out) network, and its
// squid proxy container if they don't already exist, then returns what a
// caller needs to actually use it.
export async function ensureEgressNetwork(profileName) {
  const profile = PROFILES[profileName];
  if (!profile) throw new Error(`Unknown egress profile "${profileName}".`);

  if (!(await networkExists(EXTERNAL_NETWORK))) {
    await execFileAsync("docker", ["network", "create", EXTERNAL_NETWORK]);
  }
  if (!(await networkExists(profile.internalNetwork))) {
    await execFileAsync("docker", ["network", "create", "--internal", profile.internalNetwork]);
  }

  if (!(await containerIsRunning(profile.proxyContainer))) {
    await ensureSquidImage();

    // Clear out any stopped/crashed container with the same name before
    // recreating — `docker run` fails if the name is already taken.
    await execFileAsync("docker", ["rm", "-f", profile.proxyContainer]).catch(() => {});

    const confDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentone-squid-"));
    fs.writeFileSync(path.join(confDir, "squid.conf"), buildSquidConf(profile.allowedHosts));

    await execFileAsync("docker", [
      "run", "-d", "--name", profile.proxyContainer,
      "--network", profile.internalNetwork,
      "-v", `${confDir}/squid.conf:/etc/squid/squid.conf:ro`,
      SQUID_IMAGE_TAG,
    ]);
    await execFileAsync("docker", ["network", "connect", EXTERNAL_NETWORK, profile.proxyContainer]);
  }

  return {
    network: profile.internalNetwork,
    proxyHost: profile.proxyContainer,
    proxyPort: 3128,
  };
}
