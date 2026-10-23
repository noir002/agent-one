import mongoose from "mongoose";

const DISPUTE_REVIEW_DAYS = 7;

// Owners file disputes against a failed trace/score, now that TaskRun
// exists to link to (Phase 2+). "Admin review within 7 days" is a process
// commitment the HLD makes, not something code can enforce — dueAt exists
// so the admin console can surface overdue ones, as a tracking aid.
const disputeSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  filedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  relatedRunId: { type: mongoose.Schema.Types.ObjectId, ref: "TaskRun", default: null },
  reason: { type: String, required: true },
  status: { type: String, enum: ["open", "resolved"], default: "open" },
  resolution: { type: String, default: "" },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  dueAt: { type: Date, default: () => new Date(Date.now() + DISPUTE_REVIEW_DAYS * 24 * 60 * 60 * 1000) },
}, { timestamps: true });

disputeSchema.index({ status: 1 });

export default mongoose.model("Dispute", disputeSchema);
