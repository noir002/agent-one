import mongoose from "mongoose";
import { CATEGORIES } from "@agentone/shared";

// The "wide" layer, deliberately separate from Listing/the eval harness
// (the "deep" layer). A Listing only exists once its owner has proven
// domain ownership and connected a real, runnable endpoint — rigor that
// keeps the deep catalogue small. DirectoryTool has no such bar: it's a
// broad, lightly-verified index of real third-party tools, discovered via
// public directory sites but never copied from them — every fact and logo
// URL here points back to that tool's own site (sourceUrl), the same rule
// the original Listing seed data follows. Never merged into Listing; no
// code path that reads Listing (Home, Leaderboard, Agent Finder, the MCP
// server) ever reads this collection, and vice versa.
const securitySchema = new mongoose.Schema({
  checkedAt: { type: Date, default: null },
  httpsValid: { type: Boolean, default: null },
  securityHeadersFound: { type: Number, default: null }, // out of 4 checked
  securityHeadersTotal: { type: Number, default: 4 },
  privacyPolicyFound: { type: Boolean, default: null },
  isOpenSource: { type: Boolean, default: false },
  repoUrl: { type: String, default: "" },
  repoStars: { type: Number, default: null },
  repoLicense: { type: String, default: "" },
}, { _id: false });

const directoryToolSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  logoUrl: { type: String, default: "" },
  description: { type: String, required: true },
  category: { type: String, enum: CATEGORIES, required: true },
  basePrice: { type: String, default: "unknown" }, // e.g. "Free", "Freemium — from $20/mo", "Paid — $49/mo"
  useCase: { type: String, required: true },

  // Provenance — mirrors Listing.factSource's role. Never the directory
  // site this was discovered through.
  sourceUrl: { type: String, required: true },
  rankSource: { type: String, default: "" }, // which discovery directory, e.g. "aixploria"
  rankPosition: { type: Number, default: null },
  addedBatch: { type: Number, required: true },

  // Outbound only — links to the vendor's own public demo/trial. Never an
  // in-house run: there's no verified connection for these tools (that's
  // what Listing + a real manifest is for).
  demoUrl: { type: String, default: "" },

  // "Website security hygiene — automated, public signals; not a test of
  // the agent's behavior." Deliberately a different shape and a different
  // collection from Listing.scoreParts.safety, which comes from the real
  // harness actually running prompt-injection/data-leak/refusal tasks
  // against a connected agent. This only checks the tool's own website.
  security: { type: securitySchema, default: () => ({}) },

  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
  },

  status: { type: String, enum: ["active", "hidden"], default: "active" },
}, { timestamps: true });

directoryToolSchema.index({ category: 1 });
directoryToolSchema.index({ addedBatch: 1 });

export default mongoose.model("DirectoryTool", directoryToolSchema);
