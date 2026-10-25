import { Router } from "express";
import Listing from "../models/Listing.js";
import EvalRun from "../models/EvalRun.js";
import TaskRun from "../models/TaskRun.js";
import Task from "../models/Task.js";

const router = Router();
const LISTING_FIELDS = "slug name tier score scoreParts category";

// isPrivate: false — this page is fully public, so a private EvalRun
// (Phase 8 credits feature — no public score) must never surface here,
// even just as pass/fail counts; that would defeat the point of "private."
async function latestDoneEvalRun(listingId) {
  return EvalRun.findOne({ listingId, status: "done", isPrivate: false }).sort({ completedAt: -1 }).lean();
}

// "Agent A vs Agent B on 30 research tasks" (HLD) — a task-by-task
// breakdown within one category, reusing each listing's most recent
// EvalRun (the same 3-runs-per-task TaskRun data the harness already
// recorded; no new eval work). Same-category only: comparing a code agent
// against a research agent on different task suites wouldn't mean anything.
router.get("/:slugA/:slugB", async (req, res) => {
  const { slugA, slugB } = req.params;
  if (slugA === slugB) return res.status(400).json({ error: "Pick two different listings." });

  const [listingA, listingB] = await Promise.all([
    Listing.findOne({ slug: slugA, status: "active" }).select(LISTING_FIELDS).lean(),
    Listing.findOne({ slug: slugB, status: "active" }).select(LISTING_FIELDS).lean(),
  ]);
  if (!listingA || !listingB) return res.status(404).json({ error: "One or both listings were not found." });
  if (listingA.category !== listingB.category) {
    return res.status(400).json({ error: "Head-to-head only compares listings in the same category." });
  }

  const [evalRunA, evalRunB] = await Promise.all([
    latestDoneEvalRun(listingA._id),
    latestDoneEvalRun(listingB._id),
  ]);
  if (!evalRunA || !evalRunB) {
    const missing = !evalRunA ? listingA.name : listingB.name;
    return res.status(409).json({ error: `${missing} hasn't completed a benchmark run yet.` });
  }

  const tasks = await Task.find({ category: listingA.category, isPublicSample: false })
    .select("title isSafetyTask").sort({ title: 1 }).lean();

  const [taskRunsA, taskRunsB] = await Promise.all([
    TaskRun.find({ evalRunId: evalRunA._id }).select("taskId outcome").lean(),
    TaskRun.find({ evalRunId: evalRunB._id }).select("taskId outcome").lean(),
  ]);

  const tally = (taskRuns, taskId) => {
    const runs = taskRuns.filter((r) => r.taskId.toString() === taskId.toString());
    return { passCount: runs.filter((r) => r.outcome === "pass").length, total: runs.length };
  };

  let aWins = 0, bWins = 0, ties = 0;
  const breakdown = tasks.map((task) => {
    const a = tally(taskRunsA, task._id);
    const b = tally(taskRunsB, task._id);
    const aPassed = a.total > 0 && a.passCount * 2 >= a.total; // "passes on 2 of 3"
    const bPassed = b.total > 0 && b.passCount * 2 >= b.total;
    let winner = "tie";
    if (aPassed && !bPassed) { winner = "a"; aWins++; }
    else if (bPassed && !aPassed) { winner = "b"; bWins++; }
    else ties++;
    return { taskId: task._id, title: task.title, isSafetyTask: task.isSafetyTask, a, b, winner };
  });

  res.json({
    listingA, listingB,
    manifestVersionA: evalRunA.manifestVersion,
    manifestVersionB: evalRunB.manifestVersion,
    tasks: breakdown,
    summary: { aWins, bWins, ties },
  });
});

export default router;
