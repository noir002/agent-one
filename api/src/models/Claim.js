import mongoose from "mongoose";
import crypto from "crypto";
import { CLAIM_VERIFY_METHODS, CLAIM_STATUSES } from "@agentone/shared";

const claimSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  verifyMethod: { type: String, enum: CLAIM_VERIFY_METHODS, required: true },
  verifyToken: { type: String, default: () => crypto.randomBytes(12).toString("hex") },
  // "pending" until the automated DNS/meta-tag check passes (domainVerified),
  // then it sits in the admin queue for an L1 smoke-test review before
  // flipping to "verified" (ownership + tier granted) or "rejected".
  domainVerified: { type: Boolean, default: false },
  status: { type: String, enum: CLAIM_STATUSES, default: "pending" },
  // No payment wiring yet — just records the owner's intent for later.
  fastTrack: { type: Boolean, default: false },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewedAt: { type: Date, default: null },
  reviewNote: { type: String, default: "" },
}, { timestamps: true });

claimSchema.index({ listingId: 1, status: 1 });

export default mongoose.model("Claim", claimSchema);
