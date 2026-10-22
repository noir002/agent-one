import mongoose from "mongoose";

const inputSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ["text", "textarea", "select"], default: "text" },
  required: { type: Boolean, default: false },
  placeholder: { type: String, default: "" },
  options: { type: [String], default: undefined },
}, { _id: false });

const testCaseSchema = new mongoose.Schema({
  inputs: { type: mongoose.Schema.Types.Mixed, required: true },
  mustInclude: { type: [String], default: [] },
}, { _id: false });

const agentSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  grove: { type: String, required: true },
  tagline: { type: String, default: "" },
  authorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  version: { type: Number, default: 1 },
  status: { type: String, enum: ["seedling", "verified", "hidden"], default: "seedling" },
  inputs: { type: [inputSchema], default: [] },
  systemPrompt: { type: String, required: true },
  outputFormat: { type: String, default: "markdown" },
  model: { type: String, default: "default" },
  testCases: { type: [testCaseSchema], default: [] },
  score: { type: Number, default: 0 },
  stats: {
    runs: { type: Number, default: 0 },
    avgRating: { type: Number, default: 0 },
    passRate: { type: Number, default: 0 },
  },
}, { timestamps: true });

agentSchema.index({ grove: 1 });

export default mongoose.model("Agent", agentSchema);
