import { Router } from "express";
import Listing from "../models/Listing.js";
import Manifest from "../models/Manifest.js";
import QuickRun from "../models/QuickRun.js";
import Review from "../models/Review.js";
import { getRunner } from "../harness/runners/index.js";

const router = Router();
const QUICK_RUN_DAILY_LIMIT = 10;

// A one-off, unscored run so a regular visitor can actually try a listing
// and then leave a run-backed review — not part of the harness's 3x-per-task
// EvalRun pipeline. Dispatches through the same getRunner() the harness
// uses, so it inherits the SSRF-safe runners from Phase 2 for free.
// Restricted to http/mcp (see the Phase 5 plan for why docker is excluded)
// and requires sign-in, since this hits a real third party's
// infrastructure on a random visitor's say-so.
router.post("/listings/:slug/quick-run", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in to run this agent." });

  const { input } = req.body || {};
  if (!input || typeof input !== "string" || !input.trim()) {
    return res.status(400).json({ error: "input is required." });
  }

  const listing = await Listing.findOne({ slug: req.params.slug });
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (!listing.manifestId || !["http", "mcp"].includes(listing.interfaceType)) {
    return res.status(409).json({ error: "This listing has no connected http/mcp manifest to run." });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (req.session.quickRunDate !== today) {
    req.session.quickRunCount = 0;
    req.session.quickRunDate = today;
  }
  if ((req.session.quickRunCount || 0) >= QUICK_RUN_DAILY_LIMIT) {
    return res.status(429).json({ error: `Daily run limit (${QUICK_RUN_DAILY_LIMIT}) reached. Try again tomorrow.` });
  }
  req.session.quickRunCount = (req.session.quickRunCount || 0) + 1;

  const manifest = await Manifest.findById(listing.manifestId);
  const runner = getRunner(manifest.interface.type);
  // Runners read task.budget.{maxSteps,timeoutS} (camelCase — see Task.js);
  // manifest.permissions is a differently-shaped, owner-declared field
  // (max_steps/timeout_s) that the harness never feeds into a runner
  // directly, so it can't be reused here either.
  const pseudoTask = {
    input: input.trim(),
    fixtures: {},
    activeVariant: "original",
    paraphrase: null,
    toolsAllowed: manifest.tools || [],
    budget: { maxSteps: manifest.permissions?.max_steps || 20, timeoutS: manifest.permissions?.timeout_s || 60 },
  };

  const result = await runner({ manifest, task: pseudoTask });

  const quickRun = await QuickRun.create({
    listingId: listing._id,
    userId: req.user._id,
    input: input.trim(),
    output: result.finalOutput || "",
    events: result.events || [],
    tokens: result.tokens || 0,
    costUsd: result.costUsd || 0,
    latencyMs: result.latencyMs || 0,
    status: result.outcome === "error" ? "error" : "ok",
    errorMessage: result.errorMessage || "",
  });

  res.status(201).json({ quickRun });
});

router.post("/listings/:slug/review", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in to leave a review." });

  const { quickRunId, stars, text } = req.body || {};
  const starsNum = Number(stars);
  if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
    return res.status(400).json({ error: "stars must be an integer from 1 to 5." });
  }

  const listing = await Listing.findOne({ slug: req.params.slug });
  if (!listing) return res.status(404).json({ error: "Listing not found." });

  const quickRun = await QuickRun.findById(quickRunId);
  if (!quickRun || !quickRun.userId.equals(req.user._id) || !quickRun.listingId.equals(listing._id)) {
    return res.status(400).json({ error: "Reviews must link to a run you triggered against this listing." });
  }

  const review = await Review.findOneAndUpdate(
    { listingId: listing._id, userId: req.user._id },
    { $set: { runId: quickRun._id, stars: starsNum, text: text || "" } },
    { upsert: true, new: true }
  );

  res.status(201).json({ review });
});

router.get("/listings/:slug/reviews", async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug }).select("_id").lean();
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  const reviews = await Review.find({ listingId: listing._id })
    .populate("userId", "name")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ reviews });
});

export default router;
