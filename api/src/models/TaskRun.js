import mongoose from "mongoose";

// One of the 3 runs of one task within an EvalRun. events[] is the full
// Task API trace (step/tool_call/tool_result/message/final) — this is what
// gets shown on a public run page once share loops exist (Phase 6), and
// what a dispute (Phase 5) ultimately points back to as evidence.
const eventSchema = new mongoose.Schema({
  type: { type: String, enum: ["step", "tool_call", "tool_result", "message", "final"], required: true },
  timestamp: { type: Date, default: Date.now },
  tokens: { type: Number, default: 0 },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const taskRunSchema = new mongoose.Schema({
  evalRunId: { type: mongoose.Schema.Types.ObjectId, ref: "EvalRun", required: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
  runIndex: { type: Number, required: true }, // 1, 2 or 3

  events: { type: [eventSchema], default: [] },
  finalOutput: { type: String, default: "" },
  tokens: { type: Number, default: 0 },
  costUsd: { type: Number, default: 0 },
  latencyMs: { type: Number, default: 0 },

  outcome: { type: String, enum: ["pass", "fail", "error"], default: "error" },
  deterministicResult: { type: mongoose.Schema.Types.Mixed, default: null },
  judgeResult: { type: mongoose.Schema.Types.Mixed, default: null },
  errorMessage: { type: String, default: "" },
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

taskRunSchema.index({ evalRunId: 1, taskId: 1 });

export default mongoose.model("TaskRun", taskRunSchema);
