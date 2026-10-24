import crypto from "node:crypto";
import { Router } from "express";
import Listing from "../models/Listing.js";
import Manifest from "../models/Manifest.js";
import EvalRun from "../models/EvalRun.js";
import TaskRun from "../models/TaskRun.js";
import { enqueueEvalRun } from "../queue/evalQueue.js";
import { parseManifest, ManifestError } from "../manifest/parse.js";
import ScoreSnapshot from "../models/ScoreSnapshot.js";

const router = Router();
const FREE_PLAN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function canEvaluate(listing, user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Boolean(listing.ownerId) && listing.ownerId.equals(user._id);
}

// Admins always bypass plan gates (same convention as canEvaluate above) —
// this never affects scoring, only who's allowed to trigger/configure a
// run, so there's no anti-gaming concern in letting admins act freely here.
function hasVerificationPro(user) {
  return Boolean(user) && (user.role === "admin" || user.plan === "verification_pro");
}

// Owner connects (or updates) their agentone.yaml. The HLD requires a fresh
// run on every version bump — this is that trigger. A listing needs a
// manifest before it's eligible for L2 at all (tier only advances once
// executeEvalRun's first success promotes it, see harness/runEvalRun.js).
router.post("/listings/:slug/manifest", async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug });
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (!canEvaluate(listing, req.user)) {
    return res.status(403).json({ error: "Only the listing's owner or an admin can connect a manifest." });
  }

  const { yaml: yamlText } = req.body || {};
  if (!yamlText || typeof yamlText !== "string") {
    return res.status(400).json({ error: "Body must include `yaml`: the agentone.yaml file contents." });
  }

  let parsed;
  try {
    parsed = parseManifest(yamlText);
  } catch (err) {
    if (err instanceof ManifestError) return res.status(400).json({ error: err.message, details: err.errors });
    throw err;
  }

  const previous = listing.manifestId ? await Manifest.findById(listing.manifestId) : null;
  const versionChanged = !previous || previous.version !== parsed.version;

  const manifest = previous
    ? Object.assign(previous, parsed)
    : new Manifest({ listingId: listing._id, ...parsed });
  await manifest.save();

  listing.manifestId = manifest._id;
  listing.interfaceType = manifest.interface.type;
  await listing.save();

  let evalRun = null;
  if (versionChanged) {
    evalRun = await EvalRun.create({
      listingId: listing._id,
      manifestId: manifest._id,
      manifestVersion: manifest.version,
      triggeredBy: req.user._id,
      triggerSource: "manifest_version",
      status: "queued",
    });
    await enqueueEvalRun(evalRun._id);
  }

  res.status(versionChanged ? 202 : 200).json({ manifest, evalRun, retested: versionChanged });
});

// Triggers a fresh benchmark run — the owner/admin-initiated path. The same
// pipeline also fires automatically when a manifest's version bumps (see
// routes/claims.js or wherever the manifest gets saved for a given listing).
router.post("/listings/:slug/evaluate", async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug });
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (!canEvaluate(listing, req.user)) {
    return res.status(403).json({ error: "Only the listing's owner or an admin can trigger an evaluation." });
  }
  if (!listing.manifestId) {
    return res.status(409).json({ error: "This listing has no connected manifest yet." });
  }

  // "More frequent re-tests" is a Verification Pro benefit (HLD, Phase 8)
  // — Free-plan owners get one manual re-test per 24h. This only gates how
  // often a run can be *requested*; it never touches what a run scores.
  // The manifest-version-bump auto-retest (POST /manifest, above) is
  // unaffected either way.
  if (!hasVerificationPro(req.user)) {
    const recent = await EvalRun.findOne({
      listingId: listing._id,
      triggerSource: "manual",
      isPrivate: false, // a credits-paid private run is a separate allowance, never consumes this one
      createdAt: { $gte: new Date(Date.now() - FREE_PLAN_COOLDOWN_MS) },
    }).sort({ createdAt: -1 });
    if (recent) {
      const retryAt = new Date(recent.createdAt.getTime() + FREE_PLAN_COOLDOWN_MS);
      return res.status(429).json({
        error: `Free plan allows one manual re-test per 24h. Try again after ${retryAt.toISOString()}, or upgrade to Verification Pro.`,
        retryAt,
      });
    }
  }

  const manifest = await Manifest.findById(listing.manifestId);
  if (!manifest) return res.status(409).json({ error: "Manifest record is missing." });

  const evalRun = await EvalRun.create({
    listingId: listing._id,
    manifestId: manifest._id,
    manifestVersion: manifest.version,
    triggeredBy: req.user._id,
    triggerSource: "manual",
    status: "queued",
  });

  await enqueueEvalRun(evalRun._id);

  res.status(202).json({ evalRun });
});

// "Private eval runs (no public score) behind a credits field" (HLD,
// Phase 8) — same pipeline as a normal re-test, just flagged isPrivate so
// executeEvalRun skips publishing the score (see harness/runEvalRun.js).
router.post("/listings/:slug/evaluate-private", async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug });
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (!canEvaluate(listing, req.user)) {
    return res.status(403).json({ error: "Only the listing's owner or an admin can trigger a private evaluation." });
  }
  if (!listing.manifestId) {
    return res.status(409).json({ error: "This listing has no connected manifest yet." });
  }
  if (req.user.role !== "admin" && (req.user.credits || 0) < 1) {
    return res.status(402).json({ error: "This requires at least 1 credit. Credits are granted by an admin for now (no live payments yet)." });
  }

  const manifest = await Manifest.findById(listing.manifestId);
  if (!manifest) return res.status(409).json({ error: "Manifest record is missing." });

  if (req.user.role !== "admin") {
    req.user.credits -= 1;
    await req.user.save();
  }

  const evalRun = await EvalRun.create({
    listingId: listing._id,
    manifestId: manifest._id,
    manifestVersion: manifest.version,
    triggeredBy: req.user._id,
    triggerSource: "manual",
    isPrivate: true,
    status: "queued",
  });

  await enqueueEvalRun(evalRun._id);

  res.status(202).json({ evalRun, creditsRemaining: req.user.credits });
});

// CI hook endpoint (Verification Pro only, HLD Phase 8) — generates a
// bearer token for POST /api/ci/evaluate (routes/ci.js), shown once here.
// Regenerating invalidates the previous token (only one live at a time).
router.post("/listings/:slug/ci-token", async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug });
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (!canEvaluate(listing, req.user)) {
    return res.status(403).json({ error: "Only the listing's owner or an admin can manage its CI token." });
  }
  if (!hasVerificationPro(req.user)) {
    return res.status(403).json({ error: "The CI hook endpoint requires Verification Pro." });
  }

  const token = crypto.randomBytes(24).toString("hex");
  listing.ciTokenHash = crypto.createHash("sha256").update(token).digest("hex");
  await listing.save();

  res.status(201).json({ token, note: "Shown once — store it now. Regenerating replaces it." });
});

// Private trace detail (Verification Pro only, HLD Phase 8) — toggles
// whether GET /api/runs/task/:id (routes/runs.js) redacts this listing's
// events/finalOutput for non-owner viewers. Never affects the score/tier,
// which stay public and real either way.
router.post("/listings/:slug/hide-trace-detail", async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug });
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (!canEvaluate(listing, req.user)) {
    return res.status(403).json({ error: "Only the listing's owner or an admin can change this." });
  }
  if (!hasVerificationPro(req.user)) {
    return res.status(403).json({ error: "Private trace detail requires Verification Pro." });
  }

  const { hideTraceDetail } = req.body || {};
  listing.hideTraceDetail = Boolean(hideTraceDetail);
  await listing.save();

  res.json({ listing });
});

// Recent run history for the owner dashboard — status, score-relevant
// outcomes, and a quick view of which task runs failed (for "file a
// dispute from a failed trace").
router.get("/listings/:slug/eval-runs", async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug }).select("_id").lean();
  if (!listing) return res.status(404).json({ error: "Listing not found." });

  const evalRuns = await EvalRun.find({ listingId: listing._id }).sort({ createdAt: -1 }).limit(10).lean();
  const evalRunIds = evalRuns.map((e) => e._id);
  const failedTaskRuns = await TaskRun.find({ evalRunId: { $in: evalRunIds }, outcome: { $ne: "pass" } })
    .select("evalRunId taskId runIndex outcome errorMessage finalOutput")
    .lean();

  const failedByEvalRun = {};
  for (const tr of failedTaskRuns) {
    const key = tr.evalRunId.toString();
    (failedByEvalRun[key] ||= []).push(tr);
  }

  res.json({
    evalRuns: evalRuns.map((e) => ({ ...e, failedTaskRuns: failedByEvalRun[e._id.toString()] || [] })),
  });
});

// Every EvalRun writes a ScoreSnapshot (api/src/harness/runEvalRun.js) —
// this is the first time anything reads them back, to feed the listing
// page's score history chart.
router.get("/listings/:slug/score-history", async (req, res) => {
  const listing = await Listing.findOne({ slug: req.params.slug }).select("_id").lean();
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  const history = await ScoreSnapshot.find({ listingId: listing._id })
    .sort({ computedAt: 1 })
    .select("score parts manifestVersion computedAt")
    .lean();
  res.json({ history });
});

router.get("/eval-runs/:id", async (req, res) => {
  const evalRun = await EvalRun.findById(req.params.id).lean();
  if (!evalRun) return res.status(404).json({ error: "Eval run not found." });
  const taskRuns = await TaskRun.find({ evalRunId: evalRun._id }).sort({ taskId: 1, runIndex: 1 }).lean();
  res.json({ evalRun, taskRuns });
});

export default router;
