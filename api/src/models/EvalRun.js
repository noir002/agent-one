import mongoose from "mongoose";

// Groups the TaskRuns produced by one benchmark pass against one manifest
// version — "3 runs per task" (see TaskRun) all belong to one EvalRun.
const evalRunSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  manifestId: { type: mongoose.Schema.Types.ObjectId, ref: "Manifest", required: true },
  manifestVersion: { type: String, required: true },
  status: { type: String, enum: ["queued", "running", "done", "failed"], default: "queued" },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  // Distinguishes *why* a run was triggered — needed so the free-plan
  // cooldown (routes/evalRuns.js's POST /evaluate) only counts manual
  // "Request re-test" clicks, not a manifest version bump (a different,
  // always-allowed trigger), a CI hook call, or a spot-check.
  triggerSource: { type: String, enum: ["manual", "manifest_version", "ci", "spotcheck"], default: "manual" },
  // "Private eval runs (no public score) behind a credits field" (HLD,
  // Phase 8). executeEvalRun runs the exact same grading pipeline either
  // way — this only controls whether it publishes to Listing.score/tier/
  // ScoreSnapshot at the end (see harness/runEvalRun.js).
  isPrivate: { type: Boolean, default: false },
  error: { type: String, default: "" },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

evalRunSchema.index({ listingId: 1, createdAt: -1 });

export default mongoose.model("EvalRun", evalRunSchema);
