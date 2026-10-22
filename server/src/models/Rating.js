import mongoose from "mongoose";

const ratingSchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: "Agent", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  stars: { type: Number, min: 1, max: 5, required: true },
  comment: { type: String, default: "" },
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

ratingSchema.index({ agentId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Rating", ratingSchema);
