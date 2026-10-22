import mongoose from "mongoose";

// Owners file disputes against a failed trace/score. The trigger for that
// ("file a dispute from a failed trace") arrives with Phase 2's eval runs —
// this schema and the public disputes list exist now so the review flow is
// ready to wire up.
const disputeSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  filedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  relatedRunId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Phase 2: ref "TaskRun"
  reason: { type: String, required: true },
  status: { type: String, enum: ["open", "resolved"], default: "open" },
  resolution: { type: String, default: "" },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
}, { timestamps: true });

disputeSchema.index({ status: 1 });

export default mongoose.model("Dispute", disputeSchema);
