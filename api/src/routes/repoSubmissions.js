import crypto from "node:crypto";
import { Router } from "express";
import Listing from "../models/Listing.js";
import Manifest from "../models/Manifest.js";
import EvalRun from "../models/EvalRun.js";
import TaskRun from "../models/TaskRun.js";
import Task from "../models/Task.js";
import RepoSubmission from "../models/RepoSubmission.js";
import ScoreSnapshot from "../models/ScoreSnapshot.js";
import { encrypt } from "../services/secretCrypto.js";
import { isValidGithubRepoUrl } from "../harness/runners/dockerRunner.js";
import { computeEvalRunScore } from "../harness/scoring.js";
import { slugify } from "../utils/slugify.js";
import { createPrivateEvalRun } from "./evalRuns.js";

const router = Router();

const VALID_RUNTIMES = ["python", "node"];
const VALID_INPUT_MODES = ["stdin", "file", "env_var"];
const VALID_OUTPUT_MODES = ["stdout", "file"];

function repoNameFromUrl(repoUrl) {
  const match = repoUrl.match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(\.git)?\/?$/);
  return match ? `${match[1]}/${match[2]}` : repoUrl;
}

function canAccessSubmission(submission, user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return submission.userId.equals(user._id);
}

// A private EvalRun's score is never persisted anywhere (executeEvalRun
// only writes it to Listing/ScoreSnapshot for a *non*-private run) — it's
// otherwise just a return value the worker logs and discards. Recomputed
// on demand from the stored TaskRuns instead of threading a new persisted
// field through the harness just for this. Cheap: a handful of TaskRuns
// per submission, not a real benchmarked listing's full history.
async function scoreForEvalRun(evalRun) {
  if (!evalRun || evalRun.status !== "done") return null;
  const taskRuns = await TaskRun.find({ evalRunId: evalRun._id });
  if (!taskRuns.length) return null;
  const taskIds = [...new Set(taskRuns.map((t) => t.taskId.toString()))];
  const tasks = await Task.find({ _id: { $in: taskIds } });
  return computeEvalRunScore(taskRuns, tasks, evalRun.completedAt);
}

// The self-service "test my GitHub repo in a sandbox" submission endpoint —
// the user-facing entry point the earlier feasibility plan called for.
// Reuses the exact same credit-gated, no-cooldown trigger owner-authored
// private runs already use (createPrivateEvalRun, routes/evalRuns.js); the
// only thing specific to a repo submission is that it auto-creates its own
// minimal, hidden Listing + synthesized Manifest instead of requiring one
// to already exist.
router.post("/", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in to submit a repo for testing." });

  const { repoUrl, mode, runtimeConfig, credentials, useAgentOneDemoKey } = req.body || {};

  if (!isValidGithubRepoUrl(repoUrl)) {
    return res.status(400).json({ error: "repoUrl must be a plain https://github.com/<owner>/<repo> URL." });
  }
  if (!["advanced", "fast_path"].includes(mode)) {
    return res.status(400).json({ error: `mode must be one of: advanced, fast_path.` });
  }

  let cleanRuntimeConfig = {};
  if (mode === "fast_path") {
    const { runtime, installCommand, entryCommand, inputMode, outputMode } = runtimeConfig || {};
    if (!VALID_RUNTIMES.includes(runtime)) {
      return res.status(400).json({ error: `runtimeConfig.runtime must be one of: ${VALID_RUNTIMES.join(", ")}.` });
    }
    if (!entryCommand || typeof entryCommand !== "string" || entryCommand.length > 4000) {
      return res.status(400).json({ error: "runtimeConfig.entryCommand is required and must be under 4000 characters." });
    }
    if (installCommand && (typeof installCommand !== "string" || /[\r\n]/.test(installCommand))) {
      return res.status(400).json({ error: "runtimeConfig.installCommand must be a single line." });
    }
    if (inputMode && !VALID_INPUT_MODES.includes(inputMode)) {
      return res.status(400).json({ error: `runtimeConfig.inputMode must be one of: ${VALID_INPUT_MODES.join(", ")}.` });
    }
    if (outputMode && !VALID_OUTPUT_MODES.includes(outputMode)) {
      return res.status(400).json({ error: `runtimeConfig.outputMode must be one of: ${VALID_OUTPUT_MODES.join(", ")}.` });
    }
    cleanRuntimeConfig = {
      runtime,
      installCommand: installCommand || "",
      entryCommand,
      inputMode: inputMode || "stdin",
      outputMode: outputMode || "stdout",
    };
  }

  let encryptedCredentials = null;
  if (mode === "fast_path" && credentials && typeof credentials === "object" && Object.keys(credentials).length) {
    for (const [key, value] of Object.entries(credentials)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) || typeof value !== "string") {
        return res.status(400).json({ error: `Invalid credential key "${key}" — keys must look like an env var name, values must be strings.` });
      }
    }
    encryptedCredentials = encrypt(JSON.stringify(credentials));
  }

  const name = repoNameFromUrl(repoUrl);
  const slug = `${slugify(name)}-${crypto.randomBytes(3).toString("hex")}`;

  const listing = await Listing.create({
    slug,
    name,
    category: "general",
    interfaceType: "docker",
    sourceUrl: repoUrl,
    repoUrl,
    ownerId: req.user._id,
    status: "hidden",
  });

  const manifest = await Manifest.create({
    listingId: listing._id,
    name,
    version: "0.0.1",
    category: "general",
    owner: { name: req.user.name || name, contact: req.user.email || "unknown", verify: "meta-tag" },
    interface: {
      type: "docker",
      endpoint: repoUrl,
      buildMode: mode === "fast_path" ? "generated" : "direct",
      runtimeConfig: cleanRuntimeConfig,
    },
  });
  listing.manifestId = manifest._id;
  await listing.save();

  const submission = await RepoSubmission.create({
    userId: req.user._id,
    repoUrl,
    mode,
    runtimeConfig: cleanRuntimeConfig,
    encryptedCredentials,
    useAgentOneDemoKey: Boolean(useAgentOneDemoKey),
    listingId: listing._id,
    manifestId: manifest._id,
    status: "pending",
  });

  // Set and saved *before* enqueueing — the worker can start (and its
  // `finally` can flip this to "done"/"failed") the instant enqueueEvalRun
  // returns, so writing "running" after that point could race and stomp
  // a real completed status back to "running".
  submission.status = "running";
  await submission.save();

  let evalRun;
  try {
    evalRun = await createPrivateEvalRun(listing, manifest, req.user, { repoSubmissionId: submission._id });
  } catch (err) {
    submission.status = "pending";
    await submission.save();
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });
    throw err;
  }

  res.status(202).json({ submission, listing, evalRun, creditsRemaining: req.user.credits });
});

// Polling endpoint for the client while a submission's sandbox run is in
// flight. Only the submitter (or an admin) can see their own submission.
router.get("/:id", async (req, res) => {
  const submission = await RepoSubmission.findById(req.params.id);
  if (!submission) return res.status(404).json({ error: "Repo submission not found." });
  if (!canAccessSubmission(submission, req.user)) {
    return res.status(403).json({ error: "You can only view your own submissions." });
  }

  const evalRun = await EvalRun.findOne({ repoSubmissionId: submission._id }).sort({ createdAt: -1 });
  const listing = await Listing.findById(submission.listingId).select("slug name status score").lean();
  const scoreResult = await scoreForEvalRun(evalRun);

  res.json({
    submission,
    evalRun,
    listing,
    score: scoreResult?.score ?? null,
    scoreParts: scoreResult?.parts ?? null,
  });
});

// "Turn a private test into a real public listing." Requires the
// submission's own run to have actually finished successfully — never
// publishes a listing that was never proven to work. Recomputes the score
// from the stored TaskRuns (private runs never publish a score while
// running, see harness/runEvalRun.js) and publishes it exactly the way a
// normal non-private EvalRun would.
router.post("/:id/promote", async (req, res) => {
  const submission = await RepoSubmission.findById(req.params.id);
  if (!submission) return res.status(404).json({ error: "Repo submission not found." });
  if (!canAccessSubmission(submission, req.user)) {
    return res.status(403).json({ error: "You can only promote your own submissions." });
  }
  if (submission.status !== "done") {
    return res.status(409).json({ error: `Submission must have a completed run first (status is "${submission.status}").` });
  }

  const evalRun = await EvalRun.findOne({ repoSubmissionId: submission._id }).sort({ createdAt: -1 });
  if (!evalRun || evalRun.status !== "done") {
    return res.status(409).json({ error: "No completed eval run found for this submission." });
  }

  const listing = await Listing.findById(submission.listingId);
  if (!listing) return res.status(404).json({ error: "Listing not found." });

  const scoreResult = await scoreForEvalRun(evalRun);
  if (!scoreResult) return res.status(409).json({ error: "No scoreable task runs found for this submission." });
  const { score, parts } = scoreResult;

  await ScoreSnapshot.create({
    listingId: listing._id,
    manifestVersion: evalRun.manifestVersion,
    score,
    parts,
    computedAt: evalRun.completedAt,
  });

  listing.score = score;
  listing.scoreParts = parts;
  if (listing.tier === "L0" || listing.tier === "L1") listing.tier = "L2";
  listing.status = "active";
  await listing.save();

  res.json({ listing });
});

export default router;
