import mongoose from "mongoose";

// One row per scored eval run, so a listing's score history chart can be
// drawn and a version bump's effect stays visible. Populated starting
// Phase 2 — schema only for now.
const scorePartsSchema = new mongoose.Schema({
  success: Number,
  consistency: Number,
  safety: Number,
  efficiency: Number,
  freshness: Number,
}, { _id: false });

const scoreSnapshotSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  manifestVersion: { type: String, required: true },
  score: { type: Number, required: true },
  parts: { type: scorePartsSchema, required: true },
  computedAt: { type: Date, default: Date.now },
});

scoreSnapshotSchema.index({ listingId: 1, computedAt: -1 });

export default mongoose.model("ScoreSnapshot", scoreSnapshotSchema);
