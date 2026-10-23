import EvalRun from "../models/EvalRun.js";
import TaskRun from "../models/TaskRun.js";
import Task from "../models/Task.js";
import Listing from "../models/Listing.js";
import Manifest from "../models/Manifest.js";
import ScoreSnapshot from "../models/ScoreSnapshot.js";
import { getRunner } from "./runners/index.js";
import { runDeterministicChecks } from "./grading/deterministic.js";
import { runJudge } from "./grading/judge.js";
import { computeEvalRunScore } from "./scoring.js";

const RUNS_PER_TASK = 3;

async function runOneTask(evalRunId, manifest, task, runIndex) {
  const runner = getRunner(manifest.interface.type);
  const result = await runner({ manifest, task });

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

  try {
    const manifest = await Manifest.findById(evalRun.manifestId);
    if (!manifest) throw new Error("Manifest not found.");

    const tasks = await Task.find({ category: manifest.category });
    if (tasks.length === 0) throw new Error(`No tasks seeded for category "${manifest.category}".`);

    const allTaskRuns = [];
    for (const task of tasks) {
      for (let runIndex = 1; runIndex <= RUNS_PER_TASK; runIndex++) {
        const taskRun = await runOneTask(evalRun._id, manifest, task, runIndex);
        allTaskRuns.push(taskRun);
      }
    }

    evalRun.status = "done";
    evalRun.completedAt = new Date();
    await evalRun.save();

    const { score, parts } = computeEvalRunScore(allTaskRuns, tasks, evalRun.completedAt);

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

    return { evalRun, score, parts };
  } catch (err) {
    evalRun.status = "failed";
    evalRun.error = err.message;
    evalRun.completedAt = new Date();
    await evalRun.save();
    throw err;
  }
}
