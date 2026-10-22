import mongoose from "mongoose";
import { USER_ROLES } from "@agentone/shared";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  role: { type: String, enum: USER_ROLES, default: "user" },
  githubId: { type: String, unique: true, sparse: true },
  googleId: { type: String, unique: true, sparse: true },
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

export default mongoose.model("User", userSchema);
