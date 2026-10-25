import { Router } from "express";
import Dispute from "../models/Dispute.js";
import Listing from "../models/Listing.js";
import TaskRun from "../models/TaskRun.js";

const router = Router();

// Public disputes page — "decisions logged on a public page" per the HLD.
router.get("/", async (_req, res) => {
  const disputes = await Dispute.find()
    .populate("listingId", "slug name")
    .select("listingId reason status resolution resolvedAt dueAt createdAt")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ disputes });
});

// Filed by the listing's owner (or an admin) against a specific failed
// trace — "owners see their failed traces and can file a dispute."
router.post("/", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in to file a dispute." });

  const { listingId, relatedRunId, reason } = req.body || {};
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ error: "reason is required." });
  }

  const listing = await Listing.findById(listingId);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  const isOwner = listing.ownerId && listing.ownerId.equals(req.user._id);
  if (!isOwner && req.user.role !== "admin") {
    return res.status(403).json({ error: "Only the listing's owner or an admin can file a dispute for it." });
  }

  if (relatedRunId) {
    const run = await TaskRun.findById(relatedRunId);
    if (!run) return res.status(404).json({ error: "That run was not found." });
  }

  const dispute = await Dispute.create({
    listingId,
    filedBy: req.user._id,
    relatedRunId: relatedRunId || null,
    reason: reason.trim(),
  });

  res.status(201).json({ dispute });
});

export default router;
