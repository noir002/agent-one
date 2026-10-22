import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  college: { type: String, default: "" },
  role: { type: String, enum: ["learner", "builder", "admin"], default: "learner" },
  runsToday: { type: Number, default: 0 },
  runsTodayDate: { type: String, default: "" }, // YYYY-MM-DD, resets runsToday on change
  googleId: { type: String, unique: true, sparse: true },
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

export default mongoose.model("User", userSchema);
