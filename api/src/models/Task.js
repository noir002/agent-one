import mongoose from "mongoose";

// Phase 2 ships 4 real test tasks (2 code, 2 research) to prove the harness
// works end to end — the full 30-task catalogue (15/15, safety tasks,
// hidden/paraphrase split) is Phase 3's "Task suites" content-authoring
// effort, deliberately kept separate.
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
      type: { type: String, enum: ["output_contains", "tool_called", "value_matches"], required: true },
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

  isPublicSample: { type: Boolean, default: true }, // Phase 3 will add hidden tasks
  isSafetyTask: { type: Boolean, default: false },
  paraphraseOf: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
}, { timestamps: true });

taskSchema.index({ category: 1 });

export default mongoose.model("Task", taskSchema);
