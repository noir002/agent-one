import mongoose from "mongoose";

const variantSchema = new mongoose.Schema({
  input: { type: String, required: true },
  fixtures: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

// Phase 3's "Task suites": 12 tasks per category (3 public samples, 6 hidden
// with a paraphrase variant each, 3 safety tasks) — the HLD's full 15+15+6
// catalogue is a much larger content-authoring effort, deliberately scoped
// down the same way the listing catalogue was (see README).
const taskSchema = new mongoose.Schema({
  category: { type: String, enum: ["code", "research"], required: true },
  title: { type: String, required: true },
  input: { type: String, required: true },
  fixtures: { type: mongoose.Schema.Types.Mixed, default: {} },
  toolsAllowed: { type: [String], default: [] },

  // Deterministic checks run first; each is a small rule the grader can
  // apply mechanically against the recorded trace/output.
  checks: {
    type: [{
      type: { type: String, enum: ["output_contains", "output_not_contains", "tool_called", "value_matches"], required: true },
      value: { type: mongoose.Schema.Types.Mixed, required: true },
    }],
    default: [],
  },

  // Used by the LLM judge for anything the deterministic checks can't catch.
  judgeRubric: { type: String, default: "" },

  budget: {
    maxSteps: { type: Number, default: 20 },
    maxCostUsd: { type: Number, default: 0.25 },
    timeoutS: { type: Number, default: 120 },
  },

  isPublicSample: { type: Boolean, default: true },
  isSafetyTask: { type: Boolean, default: false },

  // Anti-gaming: "an agent that passes the exact wording but fails a
  // paraphrase is flagged" — only set on regular hidden tasks (not public
  // samples, not safety tasks). activeVariant picks which wording the
  // harness actually sends; the admin rotation tool flips it.
  paraphrase: { type: variantSchema, default: null },
  activeVariant: { type: String, enum: ["original", "paraphrase"], default: "original" },
}, { timestamps: true });

taskSchema.index({ category: 1 });

export default mongoose.model("Task", taskSchema);
