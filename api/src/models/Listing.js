import mongoose from "mongoose";
import {
  TIERS, CATEGORIES, LISTING_TYPES, PRICING_MODELS, INTERFACE_TYPES,
} from "@agentone/shared";

const scorePartsSchema = new mongoose.Schema({
  success: Number,
  consistency: Number,
  safety: Number,
  efficiency: Number,
  freshness: Number,
}, { _id: false });

const listingSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, enum: LISTING_TYPES, default: "agent" },
  category: { type: String, enum: CATEGORIES, required: true },
  tier: { type: String, enum: TIERS, default: "L0" },
  tagline: { type: String, default: "" },
  description: { type: String, default: "" },
  pricing: { type: String, enum: PRICING_MODELS, default: "unknown" },
  openSource: { type: Boolean, default: false },
  interfaceType: { type: String, enum: INTERFACE_TYPES, default: "none" },
  sourceUrl: { type: String, required: true },
  repoUrl: { type: String, default: "" },
  logoUrl: { type: String, default: "" },

  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  manifestId: { type: mongoose.Schema.Types.ObjectId, ref: "Manifest", default: null },

  status: { type: String, enum: ["active", "hidden", "merged"], default: "active" },
  isFlagship: { type: Boolean, default: false },
  isSponsored: { type: Boolean, default: false },

  // Populated by daily freshness checks (api/scripts/freshnessCheck.js).
  lastVerifiedAt: { type: Date, default: null },
  lastCheckStatus: { type: String, enum: ["ok", "unreachable", "unknown"], default: "unknown" },

  // Populated by the eval harness once it exists — null/unset until an agent
  // reaches L2 and runs its first suite.
  score: { type: Number, default: null },
  scoreParts: { type: scorePartsSchema, default: null },

  // Where the listing's facts came from (for the "never copy another
  // directory" rule) — the agent's own site/repo, recorded for audit.
  factSource: { type: String, default: "" },

  // Set by the weekly spot-check script (api/scripts/spotCheck.js) when a
  // random re-test's score differs a lot from the listing's prior snapshot
  // — a possible sign of gaming or an unstable agent. Cleared by an admin
  // once reviewed (see routes/admin.js).
  scoreGapFlag: {
    type: new mongoose.Schema({
      at: Date,
      previousScore: Number,
      newScore: Number,
      gap: Number,
    }, { _id: false }),
    default: null,
  },
}, { timestamps: true });

listingSchema.index({ category: 1 });
listingSchema.index({ tier: 1 });
listingSchema.index({ score: -1 });
listingSchema.index({ name: "text", tagline: "text", description: "text" });

export default mongoose.model("Listing", listingSchema);
