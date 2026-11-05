import EvalRun from "../models/EvalRun.js";
import TaskRun from "../models/TaskRun.js";
import Task from "../models/Task.js";
import Listing from "../models/Listing.js";
import Manifest from "../models/Manifest.js";
import ScoreSnapshot from "../models/ScoreSnapshot.js";
import RepoSubmission from "../models/RepoSubmission.js";
import { decrypt } from "../services/secretCrypto.js";
import { getRunner } from "./runners/index.js";
import { runDeterministicChecks } from "./grading/deterministic.js";
import { runJudge } from "./grading/judge.js";
import { computeEvalRunScore } from "./scoring.js";

const RUNS_PER_TASK = 3;

async function runOneTask(evalRunId, manifest, task, runIndex, envOverrides) {
  const runner = getRunner(manifest.interface.type);
  // envOverrides is only ever non-empty for a repo-submission run; http/
  // mcp/a2a runners destructure just {manifest, task} and ignore it.
  // dockerRunner.js doesn't act on it yet either — wiring it into the
  // actual `docker run -e` injection is Phase C, once the fast-path shim
  // exists to consume it.
  const result = await runner({ manifest, task, envOverrides });

  let outcome = result.outcome === "error" ? "error" : "fail";
  let deterministicResult = null;
  let judgeResult = null;

  if (result.outcome === "ok") {
    deterministicResult = runDeterministicChecks(task, result);
    judgeResult = task.judgeRubric ? await runJudge(task, result) : null;

    const deterministicPass = deterministicResult.pass;
    const judgePass = !judgeResult || judgeResult.verdict === "PASS" || judgeResult.verdict === "SKIPPED";
    outcome = deterministicPass && judgePass ? "pass" : "fail";
  }

  return TaskRun.create({
    evalRunId,
    taskId: task._id,
    runIndex,
    events: result.events,
    finalOutput: result.finalOutput,
    tokens: result.tokens,
    costUsd: result.costUsd,
    latencyMs: result.latencyMs,
    outcome,
    deterministicResult,
    judgeResult,
    errorMessage: result.errorMessage || "",
  });
}

// The whole Phase 2 pipeline for one EvalRun: run every task 3x, grade each
// run, score the set, and update the listing. Called by the worker's BullMQ
// processor — kept as a plain function so it's also directly callable from
// a test/verification script without going through the queue.
export async function executeEvalRun(evalRunId) {
  const evalRun = await EvalRun.findById(evalRunId);
  if (!evalRun) throw new Error(`EvalRun not found: ${evalRunId}`);

  evalRun.status = "running";
  evalRun.startedAt = new Date();
  await evalRun.save();

  // Loaded (and its credential blob decrypted) once up front, outside the
  // try below, so it's in scope for the `finally` no matter where this
  // run fails. Every non-repo-submission EvalRun leaves repoSubmissionId
  // null and this whole block is skipped.
  let repoSubmission = null;
  let envOverrides = {};
  if (evalRun.repoSubmissionId) {
    repoSubmission = await RepoSubmission.findById(evalRun.repoSubmissionId);
    // "Use Agent One's own demo key" — resolved here, server-side, from
    // process.env, the same way the judge already resolves its own LLM
    // credential; the client never sees the real value. Applied first so
    // an explicitly pasted credential (next) always wins if both are set.
    if (repoSubmission?.useAgentOneDemoKey && process.env.LLM_API_KEY) {
      envOverrides.GROQ_API_KEY = process.env.LLM_API_KEY;
    }
    // The encrypted blob is a JSON string of { ENV_VAR_NAME: "value" }
    // pairs — the shape Phase C's docker shim expects to inject via
    // `docker run -e`.
    if (repoSubmission?.encryptedCredentials) {
      Object.assign(envOverrides, JSON.parse(decrypt(repoSubmission.encryptedCredentials)));
    }
  }

  try {
    const manifest = await Manifest.findById(evalRun.manifestId);
    if (!manifest) throw new Error("Manifest not found.");

    // "Score only on hidden tasks" (HLD anti-gaming rule) — public samples
    // exist so an owner can see the format, never to be scored against.
    const tasks = await Task.find({ category: manifest.category, isPublicSample: false });
    if (tasks.length === 0) throw new Error(`No hidden tasks seeded for category "${manifest.category}".`);

    const allTaskRuns = [];
    for (const task of tasks) {
      for (let runIndex = 1; runIndex <= RUNS_PER_TASK; runIndex++) {
        const taskRun = await runOneTask(evalRun._id, manifest, task, runIndex, envOverrides);
        allTaskRuns.push(taskRun);
      }
    }

    evalRun.status = "done";
    evalRun.completedAt = new Date();
    await evalRun.save();

    const { score, parts } = computeEvalRunScore(allTaskRuns, tasks, evalRun.completedAt);

    // "Private eval runs (no public score) behind a credits field" (HLD,
    // Phase 8) — grading above ran through the identical pipeline either
    // way (same deterministic checks, same judge, same TaskRun storage);
    // a private run only skips *publishing* the result. No payment/plan
    // ever reaches the scoring math itself — this is a visibility gate on
    // the output of computeEvalRunScore, not a different computation.
    if (!evalRun.isPrivate) {
      await ScoreSnapshot.create({
        listingId: evalRun.listingId,
        manifestVersion: evalRun.manifestVersion,
        score,
        parts,
        computedAt: evalRun.completedAt,
      });

      const listing = await Listing.findById(evalRun.listingId);
      listing.score = score;
      listing.scoreParts = parts;
      // A successful benchmark run always means at least L2 (Benchmarked) —
      // normally a listing reaches this via L1 first (claimed + owner-verified),
      // but an admin can also connect a manifest directly from L0, so promote
      // from either; never downgrade L3 (Sandboxed is Phase 4's higher tier).
      if (listing.tier === "L0" || listing.tier === "L1") listing.tier = "L2";
      await listing.save();
    }

    return { evalRun, score, parts };
  } catch (err) {
    evalRun.status = "failed";
    evalRun.error = err.message;
    evalRun.completedAt = new Date();
    await evalRun.save();
    throw err;
  } finally {
    // Held just long enough to get from submission to this one sandbox
    // run — never "saved". Runs whether the try block returned or threw,
    // so a credential is never left sitting encrypted-at-rest just
    // because the run itself failed.
    if (repoSubmission) {
      repoSubmission.encryptedCredentials = null;
      repoSubmission.status = evalRun.status === "done" ? "done" : "failed";
      await repoSubmission.save();
    }
  }
}
