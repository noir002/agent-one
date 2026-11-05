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
import { encrypt } from "../src/services/secretCrypto.js";
import { executeEvalRun } from "../src/harness/runEvalRun.js";

// Manual check for Phase C's fast path: a real public repo with NO
// Dockerfile of its own, built via the generated Dockerfile+shim, proving
// three things in one entry command: (1) the repo was actually git-cloned
// during the build (reads README from the clone), (2) the shim correctly
// delivers task.input to the entry command via stdin, and (3) a pasted
// credential actually reaches the container as an env var at run time.
// octocat/Hello-World is GitHub's own canonical tiny public test repo.
async function main() {
  await connectDB();

  let user = await User.findOne({ email: "verify-phase-c@example.com" });
  if (!user) {
    user = await User.create({ email: "verify-phase-c@example.com", name: "Phase C Verify" });
  }

  const entryCommand = `python3 -c "import sys, os; print('REPO:' + open('README').read().strip() + '|INPUT:' + sys.stdin.read().strip() + '|CRED:' + os.environ.get('TEST_VAR',''))"`;
  const runtimeConfig = { runtime: "python", installCommand: "", entryCommand, inputMode: "stdin", outputMode: "stdout" };

  const listing = await Listing.create({
    slug: `phase-c-verify-${Date.now()}`,
    name: "Phase C Verify Agent",
    category: "general",
    interfaceType: "docker",
    sourceUrl: "https://github.com/octocat/Hello-World",
    repoUrl: "https://github.com/octocat/Hello-World",
    ownerId: user._id,
    status: "hidden",
  });

  const manifest = await Manifest.create({
    listingId: listing._id,
    name: "Phase C Verify Agent",
    version: "0.0.1",
    category: "general",
    owner: { name: "Phase C Verify", contact: "verify-phase-c@example.com", verify: "meta-tag" },
    interface: {
      type: "docker",
      endpoint: "https://github.com/octocat/Hello-World",
      buildMode: "generated",
      runtimeConfig,
    },
  });
  listing.manifestId = manifest._id;
  await listing.save();

  const submission = await RepoSubmission.create({
    userId: user._id,
    repoUrl: "https://github.com/octocat/Hello-World",
    mode: "fast_path",
    runtimeConfig,
    encryptedCredentials: encrypt(JSON.stringify({ TEST_VAR: "fastpath-cred-ok" })),
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

  const finalSubmission = await RepoSubmission.findById(submission._id);
  const taskRuns = await TaskRun.find({ evalRunId: evalRun._id }).limit(1);
  console.log("[verify] RepoSubmission.encryptedCredentials after run (should be null):", finalSubmission.encryptedCredentials);
  if (taskRuns.length) {
    console.log("[verify] outcome:", taskRuns[0].outcome);
    console.log("[verify] errorMessage:", taskRuns[0].errorMessage);
    console.log("[verify] finalOutput:", JSON.stringify(taskRuns[0].finalOutput));
    console.log("[verify] events:", JSON.stringify(taskRuns[0].events, null, 2));
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
