import mongoose from "mongoose";
import { CATEGORIES, INTERFACE_TYPES, PRICING_MODELS } from "@agentone/shared";

// Mirrors agentone.yaml. Parsed/validated by src/manifest/parse.js when an
// owner submits one via a claim. Not consumed by any runner yet — that's
// Phase 2's eval harness.
const manifestSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  name: { type: String, required: true },
  version: { type: String, required: true },
  category: { type: String, enum: CATEGORIES, required: true },
  summary: { type: String, default: "" },

  owner: {
    name: { type: String, required: true },
    contact: { type: String, required: true },
    verify: { type: String, enum: ["dns", "meta-tag"], required: true },
  },

  interface: {
    type: { type: String, enum: INTERFACE_TYPES, required: true },
    endpoint: { type: String, default: "" },
    auth: { type: String, default: "" }, // the scheme name only — no credential is ever stored on a Manifest
    streaming: { type: String, default: "" },
    // "direct" (default): endpoint IS the Docker build context, today's
    // only behavior for owner-authored manifests. "generated": a
    // self-service fast-path submission — endpoint is just a repo URL,
    // and dockerRunner.js's ensureImage() generates a wrapper Dockerfile +
    // shim (from runtimeConfig) that clones it internally.
    buildMode: { type: String, enum: ["direct", "generated"], default: "direct" },
    runtimeConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  },

  model: { type: [String], default: ["any"] },
  tools: { type: [String], default: [] },

  permissions: {
    network: { type: String, enum: ["none", "allowlist", "open"], default: "none" },
    max_steps: { type: Number, default: 40 },
    max_cost_usd: { type: Number, default: 0.5 },
    timeout_s: { type: Number, default: 300 },
  },

  pricing: {
    model: { type: String, enum: PRICING_MODELS, default: "unknown" },
  },

  license: { type: String, default: "" },
  repo: { type: String, default: "" },

  rawYaml: { type: String, default: "" },
}, { timestamps: true });

manifestSchema.index({ listingId: 1 });

export default mongoose.model("Manifest", manifestSchema);
