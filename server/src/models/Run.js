import mongoose from "mongoose";
import crypto from "crypto";

const runSchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  inputs: { type: mongoose.Schema.Types.Mixed, required: true },
  output: { type: String, default: "" },
  latencyMs: { type: Number, default: 0 },
  tokens: { type: Number, default: 0 },
  status: { type: String, enum: ["ok", "error", "timeout"], default: "ok" },
  shareId: { type: String, required: true, unique: true, default: () => crypto.randomBytes(6).toString("hex") },
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

runSchema.index({ agentId: 1 });

export default mongoose.model("Run", runSchema);
