import mongoose from "mongoose";

// Groups the TaskRuns produced by one benchmark pass against one manifest
// version — "3 runs per task" (see TaskRun) all belong to one EvalRun.
const evalRunSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  manifestId: { type: mongoose.Schema.Types.ObjectId, ref: "Manifest", required: true },
  manifestVersion: { type: String, required: true },
  status: { type: String, enum: ["queued", "running", "done", "failed"], default: "queued" },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  error: { type: String, default: "" },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

evalRunSchema.index({ listingId: 1, createdAt: -1 });

export default mongoose.model("EvalRun", evalRunSchema);
