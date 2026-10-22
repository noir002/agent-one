import mongoose from "mongoose";

const checkResultSchema = new mongoose.Schema({
  testCase: { type: mongoose.Schema.Types.Mixed, required: true },
  pass: { type: Boolean, required: true },
  reason: { type: String, default: "" },
}, { _id: false });

const checkSchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true },
  version: { type: Number, required: true },
  results: { type: [checkResultSchema], default: [] },
  safetyFlags: { type: [String], default: [] },
  ranAt: { type: Date, default: Date.now },
});

checkSchema.index({ agentId: 1 });

export default mongoose.model("Check", checkSchema);
