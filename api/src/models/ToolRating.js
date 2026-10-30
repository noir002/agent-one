import mongoose from "mongoose";

// A simple, login-gated star rating for a DirectoryTool — distinct from
// Review.js's run-backed reviews, which require actually triggering a
// QuickRun first. These tools aren't connected/runnable, so there's
// nothing to run first; this is the lighter-weight rating pattern the
// reference directories (parlexa.in) use. One rating per user per tool —
// re-rating overwrites rather than duplicating.
const toolRatingSchema = new mongoose.Schema({
  toolId: { type: mongoose.Schema.Types.ObjectId, ref: "DirectoryTool", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  stars: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, default: "" },
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

toolRatingSchema.index({ toolId: 1, userId: 1 }, { unique: true });

export default mongoose.model("ToolRating", toolRatingSchema);
