import mongoose from "mongoose";

// A frozen snapshot of the leaderboard, generated monthly by
// api/scripts/generateReport.js — stored rather than computed on read so a
// past month's report stays stable even as scores keep changing (the HLD's
// "State of agents: October" share loop, built from leaderboard data).
const topListingSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  slug: { type: String, required: true },
  name: { type: String, required: true },
  score: { type: Number, required: true },
  tier: { type: String, required: true },
}, { _id: false });

const deltaListingSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing", required: true },
  slug: { type: String, required: true },
  name: { type: String, required: true },
  previousScore: { type: Number, required: true },
  score: { type: Number, required: true },
  delta: { type: Number, required: true },
}, { _id: false });

const reportSchema = new mongoose.Schema({
  month: { type: String, required: true, unique: true }, // "YYYY-MM"
  generatedAt: { type: Date, default: Date.now },
  categories: {
    type: [{
      category: { type: String, required: true },
      topListings: { type: [topListingSchema], default: [] },
    }],
    default: [],
  },
  newlyBenchmarked: { type: [topListingSchema], default: [] },
  mostImproved: { type: [deltaListingSchema], default: [] },
  totalBenchmarked: { type: Number, default: 0 },
}, { timestamps: true });

export default mongoose.model("Report", reportSchema);
