import { loadRootEnv } from "@agentone/shared/loadEnv.js";
loadRootEnv();
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import User from "../src/models/User.js";
import Listing from "../src/models/Listing.js";
import Manifest from "../src/models/Manifest.js";
import EvalRun from "../src/models/EvalRun.js";
import RepoSubmission from "../src/models/RepoSubmission.js";
import TaskRun from "../src/models/TaskRun.js";
import { executeEvalRun } from "../src/harness/runEvalRun.js";

// Manual check for Phase D: manifest.permissions.network = "allowlist"
// should let a sandboxed container reach an allowlisted LLM provider host
// through the squid proxy, while (a) a non-allowlisted host is refused by
// the proxy's ACL and (b) a client that bypasses the proxy entirely still
// can't reach the allowlisted host either — proving the boundary is the
// --internal network having no route out at all, not just the proxy
// cooperating. Does a raw CONNECT handshake rather than a full HTTPS
// request so the result is unambiguous (tunnel established vs not),
// independent of whatever HTTP status the real API would return.
// Written via a quoted heredoc ('PYEOF') rather than a `python3 -c "..."`
// argument — a quoted heredoc body passes through the shell completely
// literally (no backslash/quote reinterpretation), so this Python source's
// own \r\n escapes and quotes need no escaping at all, regardless of how
// many times the surrounding entryCommand string itself gets JSON-encoded.
const ENTRY_COMMAND = `cat > /tmp/check.py << 'PYEOF'
import socket, os

def via_proxy(host):
    proxy = os.environ.get('HTTPS_PROXY', '').replace('http://', '')
    phost, pport = proxy.split(':')
    s = socket.create_connection((phost, int(pport)), timeout=5)
    s.sendall(('CONNECT %s:443 HTTP/1.1\\r\\nHost: %s:443\\r\\n\\r\\n' % (host, host)).encode())
    resp = s.recv(200).decode(errors='replace')
    s.close()
    return resp.split('\\r\\n')[0]

def direct(host):
    socket.create_connection((host, 443), timeout=5)
    return 'connected'

results = []
for label, fn, arg in [
    ('ALLOWED_VIA_PROXY', via_proxy, 'api.groq.com'),
    ('DISALLOWED_VIA_PROXY', via_proxy, 'example.com'),
    ('ALLOWED_BYPASS_PROXY', direct, 'api.groq.com'),
]:
    try:
        results.append(label + '=' + fn(arg))
    except Exception as e:
        results.append(label + '=error:' + type(e).__name__)

print('|'.join(results))
PYEOF
python3 /tmp/check.py`;

async function main() {
  await connectDB();

  let user = await User.findOne({ email: "verify-phase-d@example.com" });
  if (!user) {
    user = await User.create({ email: "verify-phase-d@example.com", name: "Phase D Verify" });
  }

  const runtimeConfig = {
    runtime: "python",
    installCommand: "",
    entryCommand: ENTRY_COMMAND,
    inputMode: "stdin",
    outputMode: "stdout",
  };

  const listing = await Listing.create({
    slug: `phase-d-verify-${Date.now()}`,
    name: "Phase D Verify Agent",
    category: "general",
    interfaceType: "docker",
    sourceUrl: "https://github.com/octocat/Hello-World",
    repoUrl: "https://github.com/octocat/Hello-World",
    ownerId: user._id,
    status: "hidden",
  });

  const manifest = await Manifest.create({
    listingId: listing._id,
    name: "Phase D Verify Agent",
    version: "0.0.1",
    category: "general",
    owner: { name: "Phase D Verify", contact: "verify-phase-d@example.com", verify: "meta-tag" },
    interface: {
      type: "docker",
      endpoint: "https://github.com/octocat/Hello-World",
      buildMode: "generated",
      runtimeConfig,
    },
    permissions: { network: "allowlist" },
  });
  listing.manifestId = manifest._id;
  await listing.save();

  const submission = await RepoSubmission.create({
    userId: user._id,
    repoUrl: "https://github.com/octocat/Hello-World",
    mode: "fast_path",
    runtimeConfig,
    listingId: listing._id,
    manifestId: manifest._id,
    status: "pending",
  });

  const evalRun = await EvalRun.create({
    listingId: listing._id,
    manifestId: manifest._id,
    manifestVersion: manifest.version,
    isPrivate: true,
    repoSubmissionId: submission._id,
  });

  try {
    const { score } = await executeEvalRun(evalRun._id);
    console.log("[verify] EvalRun completed. score:", score);
  } catch (err) {
    console.log("[verify] EvalRun failed:", err.message);
  }

  const taskRuns = await TaskRun.find({ evalRunId: evalRun._id }).limit(1);
  if (taskRuns.length) {
    console.log("[verify] outcome:", taskRuns[0].outcome, "| errorMessage:", taskRuns[0].errorMessage);
    console.log("[verify] finalOutput (expect ALLOWED_VIA_PROXY=HTTP/1.1 200 ..., DISALLOWED_VIA_PROXY=error:..., ALLOWED_BYPASS_PROXY=error:...):");
    console.log("  ", taskRuns[0].finalOutput);
  } else {
    console.log("[verify] no TaskRuns were created — build or run likely failed before any task ran.");
  }

  await TaskRun.deleteMany({ evalRunId: evalRun._id });
  await EvalRun.deleteOne({ _id: evalRun._id });
  await RepoSubmission.deleteOne({ _id: submission._id });
  await Manifest.deleteOne({ _id: manifest._id });
  await Listing.deleteOne({ _id: listing._id });
  console.log("[verify] cleaned up throwaway Listing/Manifest/EvalRun/RepoSubmission/TaskRuns.");

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[verify] fatal:", err);
  process.exit(1);
});
