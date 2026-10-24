import mongoose from "mongoose";
import { USER_ROLES } from "@agentone/shared";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  role: { type: String, enum: USER_ROLES, default: "user" },
  githubId: { type: String, unique: true, sparse: true },
  googleId: { type: String, unique: true, sparse: true },
  // Monetization hooks (Phase 8) — no live payments; both only ever set
  // via api/src/payments/provider.js's MockPaymentProvider (an admin
  // "simulate" action today, a real gateway's webhook later). Neither
  // field is ever read by scoring.js or executeEvalRun's score/tier path.
  plan: { type: String, enum: ["free", "verification_pro"], default: "free" },
  credits: { type: Number, default: 0 },
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

export default mongoose.model("User", userSchema);
