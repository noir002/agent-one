import crypto from "node:crypto";
import { Router } from "express";
import Listing from "../models/Listing.js";
import Manifest from "../models/Manifest.js";
import EvalRun from "../models/EvalRun.js";
import { enqueueEvalRun } from "../queue/evalQueue.js";

const router = Router();

// "CI hook endpoint" (HLD, Phase 8, Verification Pro benefit) — a
// bearer-token path alongside the session-cookie one (routes/evalRuns.js's
// POST /evaluate), for triggering a re-test from a build pipeline where
// there's no browser session. Not rate-limited by the free-plan cooldown —
// this endpoint only exists for Pro owners (the token is only ever issued
// to one, see evalRuns.js's POST /ci-token) in the first place.
router.post("/evaluate", async (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token." });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const listing = await Listing.findOne({ ciTokenHash: tokenHash });
  if (!listing) return res.status(401).json({ error: "Invalid CI token." });
  if (!listing.manifestId) return res.status(409).json({ error: "This listing has no connected manifest yet." });

  const manifest = await Manifest.findById(listing.manifestId);
  if (!manifest) return res.status(409).json({ error: "Manifest record is missing." });

  const evalRun = await EvalRun.create({
    listingId: listing._id,
    manifestId: manifest._id,
    manifestVersion: manifest.version,
    triggeredBy: listing.ownerId,
    triggerSource: "ci",
    status: "queued",
  });
  await enqueueEvalRun(evalRun._id);

  res.status(202).json({ evalRun });
});

export default router;
