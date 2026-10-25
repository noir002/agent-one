import { Router } from "express";
import Claim from "../models/Claim.js";
import Listing from "../models/Listing.js";
import Dispute from "../models/Dispute.js";
import User from "../models/User.js";
import Task from "../models/Task.js";
import { checkListingFreshness } from "../services/freshnessCheck.js";
import { paymentProvider } from "../payments/provider.js";
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

// "Sponsored slots on category pages: always labelled 'Sponsored'" (HLD,
// Phase 8) — the field (Listing.isSponsored) has existed since Phase 1 and
// is already structurally excluded from every scoring/ranking query
// (buildListingSort, findAgentsForTask); this is just the first way to
// actually set it.
router.post("/listings/:id/toggle-sponsored", async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  listing.isSponsored = !listing.isSponsored;
  await listing.save();
  res.json({ listing });
});

router.post("/listings/:id/recheck-freshness", async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  const result = await checkListingFreshness(listing);
  res.json({ result, listing });
});

router.get("/disputes", async (_req, res) => {
  const disputes = await Dispute.find().populate("listingId", "slug name").sort({ createdAt: -1 }).lean();
  const now = Date.now();
  res.json({
    disputes: disputes.map((d) => ({ ...d, overdue: d.status === "open" && new Date(d.dueAt).getTime() < now }))
      .sort((a, b) => (b.overdue - a.overdue) || (new Date(b.createdAt) - new Date(a.createdAt))),
  });
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

// Listings the weekly spot-check (api/scripts/spotCheck.js) flagged for a
// large score swing between re-tests — a possible sign of gaming or an
// unstable agent, surfaced for manual review.
router.get("/score-gap-flags", async (_req, res) => {
  const listings = await Listing.find({ scoreGapFlag: { $ne: null } })
    .select("slug name scoreGapFlag")
    .sort({ "scoreGapFlag.at": -1 })
    .lean();
  res.json({ listings });
});

router.post("/listings/:id/clear-score-gap-flag", async (req, res) => {
  const listing = await Listing.findByIdAndUpdate(req.params.id, { scoreGapFlag: null }, { new: true });
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  res.json({ listing });
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

// "Leave a clean payment interface; I will choose the gateway later" (HLD,
// Phase 8) — these two routes are the only places a plan/credit grant can
// happen today (no gateway yet), and even they go through
// payments/provider.js's MockPaymentProvider rather than writing User
// fields inline, so a real gateway's webhook handler can call the same
// provider later without touching these routes.
router.get("/users", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.json({ users: [] });
  const users = await User.find({ name: new RegExp(q, "i") }).select("name email role plan credits").limit(10).lean();
  res.json({ users });
});

router.post("/users/:id/grant-plan", async (req, res) => {
  const { plan } = req.body || {};
  if (!["free", "verification_pro"].includes(plan)) {
    return res.status(400).json({ error: 'plan must be "free" or "verification_pro".' });
  }
  const user = await paymentProvider.grantPlan(req.params.id, plan);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user });
});

router.post("/users/:id/grant-credits", async (req, res) => {
  const amount = Number(req.body?.amount);
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: "amount must be a positive integer." });
  }
  const user = await paymentProvider.grantCredits(req.params.id, amount);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user });
});

export default router;
