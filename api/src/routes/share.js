import { Router } from "express";
import TaskRun from "../models/TaskRun.js";
import EvalRun from "../models/EvalRun.js";
import Task from "../models/Task.js";
import QuickRun from "../models/QuickRun.js";
import Listing from "../models/Listing.js";
import Report from "../models/Report.js";

const router = Router();
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

// Link-unfurling bots (X, LinkedIn, Discord, Slack) read <meta property=
// "og:*"> from the raw HTML they fetch — they don't run JavaScript, so a
// client-rendered SPA page (see client/index.html: one static title/
// description, no SSR) is invisible to them. These routes are a small,
// server-rendered stub per shareable resource: a human who clicks through
// gets redirected straight to the real SPA page; a bot reads the static
// tags. See the Phase 6 plan for the production-proxy piece this still
// needs (routing bots here and humans to the SPA on the *same* URL) —
// that's deployment infra this project hasn't set up yet, so this is
// verified directly (curl the stub, check the tags) rather than via a live
// unfurl test.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// title/description can embed a user-submitted listing name (POST
// /listings) — escaped before going into either attributes or body text.
function stubHtml({ title, description, image, redirectTo }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const img = escapeHtml(image);
  const url = escapeHtml(redirectTo);
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
<p>${d}</p>
<p><a href="${url}">View it on Agent One</a></p>
</body>
</html>`;
}

function send(res, opts) {
  res.set("Content-Type", "text/html");
  res.send(stubHtml(opts));
}

function ogBase(req) {
  return `${req.protocol}://${req.get("host")}/api/og`;
}

router.get("/runs/task/:id", async (req, res) => {
  const taskRun = await TaskRun.findById(req.params.id).select("taskId evalRunId outcome").lean();
  if (!taskRun) return res.status(404).type("text/plain").send("Not found");
  const evalRun = await EvalRun.findById(taskRun.evalRunId).select("listingId").lean();
  const [task, listing] = await Promise.all([
    Task.findById(taskRun.taskId).select("title").lean(),
    Listing.findById(evalRun?.listingId).select("slug name").lean(),
  ]);

  send(res, {
    title: `${listing?.name || "An agent"} on Agent One`,
    description: `${listing?.name || "This agent"} ${taskRun.outcome === "pass" ? "passed" : "failed"} "${task?.title || "a hidden task"}" — real, recorded run.`,
    image: `${ogBase(req)}/run/task/${taskRun._id}.png`,
    redirectTo: `${CLIENT_ORIGIN}/runs/task/${taskRun._id}`,
  });
});

router.get("/runs/quick/:id", async (req, res) => {
  const quickRun = await QuickRun.findById(req.params.id).populate("listingId", "slug name").lean();
  if (!quickRun) return res.status(404).type("text/plain").send("Not found");

  send(res, {
    title: `${quickRun.listingId?.name || "An agent"} on Agent One`,
    description: `A real run of ${quickRun.listingId?.name || "this agent"}, triggered live through Agent One.`,
    image: `${ogBase(req)}/run/quick/${quickRun._id}.png`,
    redirectTo: `${CLIENT_ORIGIN}/runs/quick/${quickRun._id}`,
  });
});

router.get("/head-to-head/:slugA/:slugB", async (req, res) => {
  const { slugA, slugB } = req.params;
  const [a, b] = await Promise.all([
    Listing.findOne({ slug: slugA }).select("name").lean(),
    Listing.findOne({ slug: slugB }).select("name").lean(),
  ]);
  if (!a || !b) return res.status(404).type("text/plain").send("Not found");

  send(res, {
    title: `${a.name} vs ${b.name} · Agent One`,
    description: `Task-by-task benchmark results: ${a.name} vs ${b.name} on real, recorded runs.`,
    image: `${ogBase(req)}/head-to-head/${slugA}/${slugB}.png`,
    redirectTo: `${CLIENT_ORIGIN}/head-to-head/${slugA}/${slugB}`,
  });
});

router.get("/reports/:month", async (req, res) => {
  const report = await Report.findOne({ month: req.params.month }).lean();
  if (!report) return res.status(404).type("text/plain").send("Not found");

  send(res, {
    title: `State of Agents · ${report.month} · Agent One`,
    description: `${report.totalBenchmarked} agents benchmarked by real, recorded runs this month.`,
    image: `${ogBase(req)}/reports/${report.month}.png`,
    redirectTo: `${CLIENT_ORIGIN}/reports?month=${report.month}`,
  });
});

export default router;
