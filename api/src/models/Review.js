import mongoose from "mongoose";

// Run-backed reviews: now enforced for real (Phase 5) — a review must link
// to a QuickRun the reviewer actually triggered against this listing
// through Agent One (see routes/listings.js's quick-run + review routes).
const reviewSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  runId: { type: mongoose.Schema.Types.ObjectId, ref: "QuickRun", required: true },
  stars: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, default: "" },
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

reviewSchema.index({ listingId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);
