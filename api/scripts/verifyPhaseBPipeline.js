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

// One-off manual check for Phase B of the repo-sandbox feature (see the
// plan's "Verification" section for Phase B): confirms a "general"-category
// EvalRun grades through the unmodified pipeline, and that a RepoSubmission's
// encrypted credentials are populated at creation and null after the run,
// success or failure either way. Everything created here is throwaway —
// deleted again at the end of the run.
async function main() {
  await connectDB();

  let user = await User.findOne({ email: "verify-phase-b@example.com" });
  if (!user) {
    user = await User.create({ email: "verify-phase-b@example.com", name: "Phase B Verify" });
  }

  const listing = await Listing.create({
    slug: `phase-b-verify-${Date.now()}`,
    name: "Phase B Verify Agent",
    category: "general",
    interfaceType: "http",
    sourceUrl: "http://localhost:4100/run",
    ownerId: user._id,
    status: "hidden",
  });

  const manifest = await Manifest.create({
    listingId: listing._id,
    name: "Phase B Verify Agent",
    version: "0.0.1",
    category: "general",
    owner: { name: "Phase B Verify", contact: "verify-phase-b@example.com", verify: "meta-tag" },
    interface: { type: "http", endpoint: "http://localhost:4100/run" },
  });
  listing.manifestId = manifest._id;
  await listing.save();

  const submission = await RepoSubmission.create({
    userId: user._id,
    repoUrl: "https://github.com/example/example",
    mode: "advanced",
    encryptedCredentials: encrypt(JSON.stringify({ TEST_VAR: "hello" })),
    listingId: listing._id,
    manifestId: manifest._id,
    status: "pending",
  });
  console.log("[verify] RepoSubmission created, encryptedCredentials populated:", !!submission.encryptedCredentials);

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
    console.log("[verify] EvalRun failed (may still be expected if the echo-agent fixture isn't running):", err.message);
  }

  const finalEvalRun = await EvalRun.findById(evalRun._id);
  const finalSubmission = await RepoSubmission.findById(submission._id);
  const taskRuns = await TaskRun.find({ evalRunId: evalRun._id });

  console.log("[verify] EvalRun.status:", finalEvalRun.status, "| error:", finalEvalRun.error || "(none)");
  console.log("[verify] RepoSubmission.status:", finalSubmission.status);
  console.log("[verify] RepoSubmission.encryptedCredentials after run (should be null):", finalSubmission.encryptedCredentials);
  console.log("[verify] TaskRun outcomes:", taskRuns.map((t) => t.outcome));

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
