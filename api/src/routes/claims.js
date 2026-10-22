import { Router } from "express";
import Claim from "../models/Claim.js";
import Listing from "../models/Listing.js";
import { verifyClaim } from "../services/claimVerification.js";
import { CLAIM_VERIFY_METHODS } from "@agentone/shared";

const router = Router();

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Sign in to claim a listing." });
  next();
}

router.post("/", requireAuth, async (req, res) => {
  const { listingId, verifyMethod, fastTrack } = req.body || {};
  if (!CLAIM_VERIFY_METHODS.includes(verifyMethod)) {
    return res.status(400).json({ error: `verifyMethod must be one of: ${CLAIM_VERIFY_METHODS.join(", ")}` });
  }
  const listing = await Listing.findById(listingId);
  if (!listing) return res.status(404).json({ error: "Listing not found." });
  if (listing.ownerId) return res.status(409).json({ error: "This listing already has an owner." });

  const existing = await Claim.findOne({ listingId, userId: req.user._id, status: "pending" });
  if (existing) return res.json({ claim: existing });

  const claim = await Claim.create({
    listingId,
    userId: req.user._id,
    verifyMethod,
    fastTrack: Boolean(fastTrack),
  });

  const hostname = new URL(listing.sourceUrl).hostname;
  const instructions = verifyMethod === "dns"
    ? `Add a TXT record at _agentone-verify.${hostname} with the value: ${claim.verifyToken}`
    : `Add <meta name="agentone-verify" content="${claim.verifyToken}"> to the <head> of ${listing.sourceUrl}`;

  res.status(201).json({ claim, instructions });
});

router.get("/mine", requireAuth, async (req, res) => {
  const claims = await Claim.find({ userId: req.user._id }).populate("listingId", "slug name").sort({ createdAt: -1 }).lean();
  res.json({ claims });
});

router.post("/:id/check-domain", requireAuth, async (req, res) => {
  const claim = await Claim.findById(req.params.id);
  if (!claim) return res.status(404).json({ error: "Claim not found." });
  if (!claim.userId.equals(req.user._id)) return res.status(403).json({ error: "Not your claim." });
  if (claim.status !== "pending") return res.status(409).json({ error: `Claim is already ${claim.status}.` });

  const listing = await Listing.findById(claim.listingId);
  const result = await verifyClaim(listing.sourceUrl, claim.verifyMethod, claim.verifyToken);
  claim.domainVerified = result.verified;
  await claim.save();

  res.json({ domainVerified: result.verified, reason: result.reason });
});

export default router;
