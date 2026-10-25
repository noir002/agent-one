import { Router } from "express";
import TaskRun from "../models/TaskRun.js";
import EvalRun from "../models/EvalRun.js";
import Task from "../models/Task.js";
import QuickRun from "../models/QuickRun.js";
import Listing from "../models/Listing.js";
import Report from "../models/Report.js";
import { CATEGORY_LABELS } from "@agentone/shared";
import { renderCardPng } from "../og/renderCard.js";

const router = Router();
const PNG_CACHE = "public, max-age=3600";

async function sendCard(res, opts) {
  const png = await renderCardPng(opts);
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", PNG_CACHE);
  res.send(png);
}

router.get("/run/task/:id.png", async (req, res) => {
  const taskRun = await TaskRun.findById(req.params.id).select("taskId evalRunId outcome").lean();
  if (!taskRun) return res.status(404).end();
  const evalRun = await EvalRun.findById(taskRun.evalRunId).select("listingId isPrivate").lean();
  // This is a crawler/share-facing, unauthenticated image endpoint — a
  // private EvalRun's (Phase 8) card is never generated here, full stop,
  // matching routes/runs.js's 404 for the same TaskRun.
  if (evalRun?.isPrivate) return res.status(404).end();
  const [task, listing, siblings] = await Promise.all([
    Task.findById(taskRun.taskId).select("title").lean(),
    Listing.findById(evalRun?.listingId).select("name").lean(),
    TaskRun.find({ evalRunId: taskRun.evalRunId, taskId: taskRun.taskId }).select("outcome").lean(),
  ]);
  const passCount = siblings.filter((r) => r.outcome === "pass").length;

  await sendCard(res, {
    eyebrow: "Benchmark run",
    title: `${listing?.name || "An agent"} · ${task?.title || "a task"}`,
    big: taskRun.outcome === "pass" ? "PASS" : taskRun.outcome === "fail" ? "FAIL" : "ERROR",
    subtitle: `${passCount} of ${siblings.length} recorded runs passed — tested on Agent One`,
  });
});

router.get("/run/quick/:id.png", async (req, res) => {
  const quickRun = await QuickRun.findById(req.params.id).populate("listingId", "name").lean();
  if (!quickRun) return res.status(404).end();

  await sendCard(res, {
    eyebrow: "Quick run",
    title: quickRun.listingId?.name || "An agent",
    big: quickRun.status === "ok" ? "OK" : "ERROR",
    subtitle: "run live through Agent One",
  });
});

router.get("/head-to-head/:slugA/:slugB.png", async (req, res) => {
  const [a, b] = await Promise.all([
    Listing.findOne({ slug: req.params.slugA }).select("name score category").lean(),
    Listing.findOne({ slug: req.params.slugB }).select("name score").lean(),
  ]);
  if (!a || !b) return res.status(404).end();

  await sendCard(res, {
    eyebrow: CATEGORY_LABELS[a.category] || "Head-to-head",
    title: `${a.name} vs ${b.name}`,
    big: `${a.score != null ? Math.round(a.score) : "—"} – ${b.score != null ? Math.round(b.score) : "—"}`,
    subtitle: "Task-by-task benchmark results on Agent One",
  });
});

router.get("/listing/:slug.png", async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug, status: "active" })
    .select("name category tier score tagline").lean();
  if (!listing) return res.status(404).end();

  await sendCard(res, {
    eyebrow: CATEGORY_LABELS[listing.category] || listing.category,
    title: listing.name,
    big: listing.score != null ? String(Math.round(listing.score)) : listing.tier,
    subtitle: listing.tagline || "On Agent One — tested, not just claimed.",
  });
});

router.get("/reports/:month.png", async (req, res) => {
  const report = await Report.findOne({ month: req.params.month }).lean();
  if (!report) return res.status(404).end();

  await sendCard(res, {
    eyebrow: "Monthly report",
    title: `State of Agents · ${report.month}`,
    big: String(report.totalBenchmarked),
    subtitle: "agents benchmarked this month, by real recorded runs",
  });
});

export default router;
