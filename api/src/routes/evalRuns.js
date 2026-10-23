import { Router } from "express";
import Listing from "../models/Listing.js";
import Manifest from "../models/Manifest.js";
import EvalRun from "../models/EvalRun.js";
import TaskRun from "../models/TaskRun.js";
import { enqueueEvalRun } from "../queue/evalQueue.js";
import { parseManifest, ManifestError } from "../manifest/parse.js";

const router = Router();

function canEvaluate(listing, user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return Boolean(listing.ownerId) && listing.ownerId.equals(user._id);
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

  const manifest = await Manifest.findById(listing.manifestId);
  if (!manifest) return res.status(409).json({ error: "Manifest record is missing." });

  const evalRun = await EvalRun.create({
    listingId: listing._id,
    manifestId: manifest._id,
    manifestVersion: manifest.version,
    triggeredBy: req.user._id,
    status: "queued",
  });

  await enqueueEvalRun(evalRun._id);

  res.status(202).json({ evalRun });
});

router.get("/eval-runs/:id", async (req, res) => {
  const evalRun = await EvalRun.findById(req.params.id).lean();
  if (!evalRun) return res.status(404).json({ error: "Eval run not found." });
  const taskRuns = await TaskRun.find({ evalRunId: evalRun._id }).sort({ taskId: 1, runIndex: 1 }).lean();
  res.json({ evalRun, taskRuns });
});

export default router;
