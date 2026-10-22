import mongoose from "mongoose";

// Run-backed reviews: the HLD requires every review to link to a real run
// the reviewer triggered through Agent One. runId stays optional until
// Phase 2 produces runs to link to; the review route will start requiring
// it once TaskRun exists, and this schema/index are ready for that.
const reviewSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  runId: { type: mongoose.Schema.Types.ObjectId, default: null }, // Phase 2: ref "TaskRun", required
  stars: { type: Number, min: 1, max: 5, required: true },
  text: { type: String, default: "" },
}, { timestamps: { createdAt: "createdAt", updatedAt: false } });

reviewSchema.index({ listingId: 1, userId: 1 }, { unique: true });

export default mongoose.model("Review", reviewSchema);
