import { Router } from "express";
import Claim from "../models/Claim.js";
import Listing from "../models/Listing.js";
import Dispute from "../models/Dispute.js";
import User from "../models/User.js";
import Task from "../models/Task.js";
import { checkListingFreshness } from "../services/freshnessCheck.js";
import { CATEGORIES } from "@agentone/shared";

const router = Router();

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required." });
  }
  next();
}
router.use(requireAdmin);

// Claim review queue — only domain-verified claims are actionable; others
// are shown for visibility but can't be approved yet.
router.get("/claims", async (_req, res) => {
  const claims = await Claim.find({ status: "pending" })
    .populate("listingId", "slug name sourceUrl tier")
    .populate("userId", "name email")
    .sort({ domainVerified: -1, createdAt: 1 })
    .lean();
  res.json({ claims });
});

router.post("/claims/:id/approve", async (req, res) => {
  const claim = await Claim.findById(req.params.id);
  if (!claim) return res.status(404).json({ error: "Claim not found." });
  if (!claim.domainVerified) return res.status(409).json({ error: "Domain ownership isn't verified yet." });

  claim.status = "verified";
  claim.reviewedBy = req.user._id;
  claim.reviewedAt = new Date();
  claim.reviewNote = req.body?.note || "L1 smoke test passed.";
  await claim.save();

  const listing = await Listing.findById(claim.listingId);
  listing.ownerId = claim.userId;
  if (listing.tier === "L0") listing.tier = "L1";
  await listing.save();

  await User.findByIdAndUpdate(claim.userId, { role: "owner" });

  res.json({ claim, listing });
});

router.post("/claims/:id/reject", async (req, res) => {
  const claim = await Claim.findById(req.params.id);
  if (!claim) return res.status(404).json({ error: "Claim not found." });
  claim.status = "rejected";
  claim.reviewedBy = req.user._id;
  claim.reviewedAt = new Date();
  claim.reviewNote = req.body?.note || "";
  await claim.save();
  res.json({ claim });
});

router.post("/listings/:id/hide", async (req, res) => {
  const listing = await Listing.findByIdAndUpdate(req.params.id, { status: "hidden" }, { new: true });
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  res.json({ listing });
});

router.post("/listings/:id/unhide", async (req, res) => {
  const listing = await Listing.findByIdAndUpdate(req.params.id, { status: "active" }, { new: true });
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  res.json({ listing });
});

// Merge a duplicate listing into a canonical one.
router.post("/listings/:id/merge-into/:targetId", async (req, res) => {
  if (req.params.id === req.params.targetId) {
    return res.status(400).json({ error: "Cannot merge a listing into itself." });
  }
  const target = await Listing.findById(req.params.targetId);
  if (!target) return res.status(404).json({ error: "Target listing not found." });
  const listing = await Listing.findByIdAndUpdate(req.params.id, { status: "merged" }, { new: true });
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  res.json({ listing, target });
});

router.post("/listings/:id/recheck-freshness", async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  const result = await checkListingFreshness(listing);
  res.json({ result, listing });
});

router.get("/disputes", async (_req, res) => {
  const disputes = await Dispute.find().populate("listingId", "slug name").sort({ createdAt: -1 }).lean();
  res.json({ disputes });
});

router.post("/disputes/:id/resolve", async (req, res) => {
  const { resolution } = req.body || {};
  if (!resolution) return res.status(400).json({ error: "resolution is required." });
  const dispute = await Dispute.findByIdAndUpdate(req.params.id, {
    status: "resolved",
    resolution,
    resolvedAt: new Date(),
    resolvedBy: req.user._id,
  }, { new: true });
  if (!dispute) return res.status(404).json({ error: "Dispute not found." });
  res.json({ dispute });
});

router.get("/tasks", async (_req, res) => {
  const tasks = await Task.find().select("category title isPublicSample isSafetyTask activeVariant paraphrase").sort({ category: 1, title: 1 }).lean();
  res.json({ tasks: tasks.map((t) => ({ ...t, hasParaphrase: Boolean(t.paraphrase) })) });
});

// Anti-gaming: "re-run 10% of L2 agents... swap a third of [hidden] tasks
// every month" — this rotates a random third of the regular hidden tasks
// (safety tasks and public samples are excluded; safety tasks have no
// paraphrase, and public samples are never scored anyway) per category.
router.post("/tasks/rotate", async (_req, res) => {
  const rotated = [];
  for (const category of CATEGORIES) {
    const eligible = await Task.find({ category, isPublicSample: false, isSafetyTask: false, paraphrase: { $ne: null } });
    if (eligible.length === 0) continue;

    const count = Math.max(1, Math.floor(eligible.length / 3));
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    for (const task of shuffled.slice(0, count)) {
      task.activeVariant = task.activeVariant === "original" ? "paraphrase" : "original";
      await task.save();
      rotated.push({ category, title: task.title, activeVariant: task.activeVariant });
    }
  }
  res.json({ rotated });
});

export default router;
