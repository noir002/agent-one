import mongoose from "mongoose";

// Mirrors TaskRun's event shape (see TaskRun.js) so a QuickRun's public run
// page (Phase 6) can render the same step-by-step timeline as a benchmark
// run, not just the final text.
const eventSchema = new mongoose.Schema({
  type: { type: String, enum: ["step", "tool_call", "tool_result", "message", "final"], required: true },
  timestamp: { type: Date, default: Date.now },
  tokens: { type: Number, default: 0 },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

// A lightweight, unscored, one-off run a signed-in visitor triggers against
// a connected http/mcp listing — not part of the eval harness's 3x-per-task
// EvalRun/TaskRun pipeline, just enough to make "run-backed reviews" real
// for the 25+ third-party listings that never get a formal benchmark
// triggered by a random visitor. Dispatches through the exact same
// getRunner() the harness uses (api/src/harness/runners/index.js) — no new
// runner code, so it inherits the same SSRF protections for free.
const quickRunSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  input: { type: String, required: true },
  output: { type: String, default: "" },
  events: { type: [eventSchema], default: [] },
  tokens: { type: Number, default: 0 },
  costUsd: { type: Number, default: 0 },
  latencyMs: { type: Number, default: 0 },
  status: { type: String, enum: ["ok", "error"], default: "ok" },
  errorMessage: { type: String, default: "" },
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

quickRunSchema.index({ listingId: 1, userId: 1 });

export default mongoose.model("QuickRun", quickRunSchema);
