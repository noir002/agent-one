import { Router } from "express";
import TaskRun from "../models/TaskRun.js";
import EvalRun from "../models/EvalRun.js";
import Task from "../models/Task.js";
import Listing from "../models/Listing.js";
import QuickRun from "../models/QuickRun.js";

const router = Router();

// Public run pages (Phase 6's "share loops"): no auth, anyone with the link
// can see a run. Shows the real hidden-task content and the agent's real
// recorded output — see the Phase 6 plan for why that's the resolved design
// call (the anti-gaming defenses are paraphrase/rotation surviving partial
// exposure, not secrecy of wording forever; a run page is proof, which only
// works if it's the real thing).
router.get("/task/:id", async (req, res) => {
  const taskRun = await TaskRun.findById(req.params.id).lean();
  if (!taskRun) return res.status(404).json({ error: "Run not found." });

  const evalRun = await EvalRun.findById(taskRun.evalRunId).select("listingId manifestVersion completedAt").lean();
  if (!evalRun) return res.status(404).json({ error: "Run not found." });

  const [task, listing, siblingRuns] = await Promise.all([
    Task.findById(taskRun.taskId).select("title category").lean(),
    Listing.findById(evalRun.listingId).select("slug name").lean(),
    TaskRun.find({ evalRunId: taskRun.evalRunId, taskId: taskRun.taskId }).select("outcome runIndex").lean(),
  ]);

  res.json({
    taskRun,
    task,
    listing,
    manifestVersion: evalRun.manifestVersion,
    passCount: siblingRuns.filter((r) => r.outcome === "pass").length,
    totalRuns: siblingRuns.length,
  });
});

router.get("/quick/:id", async (req, res) => {
  const quickRun = await QuickRun.findById(req.params.id)
    .populate("userId", "name")
    .populate("listingId", "slug name")
    .lean();
  if (!quickRun) return res.status(404).json({ error: "Run not found." });
  res.json({ quickRun });
});

export default router;
