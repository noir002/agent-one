import { loadRootEnv } from "@agentone/shared/loadEnv.js";
loadRootEnv();
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import Listing from "../src/models/Listing.js";
import ScoreSnapshot from "../src/models/ScoreSnapshot.js";
import Report from "../src/models/Report.js";
import { CATEGORIES } from "@agentone/shared";

const TOP_N = 10;
const MOST_IMPROVED_N = 5;
const DELTA_LOOKBACK_DAYS = 30;

function currentMonth() {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

// Monthly benchmark report (HLD's "State of agents: October" share loop):
// a frozen snapshot of the leaderboard, so a past month's report stays
// stable even as scores keep moving. Cron-ready, same pattern as
// spotCheck.js/freshnessCheck.js. Idempotent — re-running for the same
// month overwrites that month's report rather than duplicating it.
async function main() {
  await connectDB();
  const month = currentMonth();
  const monthStart = new Date(`${month}-01T00:00:00.000Z`);

  const scoredListings = await Listing.find({ status: "active", isFlagship: { $ne: true }, score: { $ne: null } })
    .select("slug name category score tier createdAt").lean();

  const categories = [];
  for (const category of CATEGORIES) {
    const topListings = scoredListings
      .filter((l) => l.category === category)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N)
      .map((l) => ({ listingId: l._id, slug: l.slug, name: l.name, score: l.score, tier: l.tier }));
    if (topListings.length > 0) categories.push({ category, topListings });
  }

  const newlyBenchmarked = [];
  const deltas = [];
  const lookbackDate = new Date(Date.now() - DELTA_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);

  for (const listing of scoredListings) {
    const firstSnapshot = await ScoreSnapshot.findOne({ listingId: listing._id }).sort({ computedAt: 1 }).select("computedAt").lean();
    if (firstSnapshot && new Date(firstSnapshot.computedAt) >= monthStart) {
      newlyBenchmarked.push({ listingId: listing._id, slug: listing.slug, name: listing.name, score: listing.score, tier: listing.tier });
      continue; // a brand-new listing has no 30-day-old snapshot to diff against
    }

    const priorSnapshot = await ScoreSnapshot.findOne({ listingId: listing._id, computedAt: { $lte: lookbackDate } })
      .sort({ computedAt: -1 }).select("score").lean();
    if (priorSnapshot) {
      const delta = listing.score - priorSnapshot.score;
      if (delta > 0) {
        deltas.push({ listingId: listing._id, slug: listing.slug, name: listing.name, previousScore: priorSnapshot.score, score: listing.score, delta });
      }
    }
  }

  const mostImproved = deltas.sort((a, b) => b.delta - a.delta).slice(0, MOST_IMPROVED_N);

  const report = await Report.findOneAndReplace(
    { month },
    { month, generatedAt: new Date(), categories, newlyBenchmarked, mostImproved, totalBenchmarked: scoredListings.length },
    { upsert: true, new: true }
  );

  console.log(`[report] ${month}: ${scoredListings.length} benchmarked, ${categories.length} categories, ${newlyBenchmarked.length} new, ${mostImproved.length} most-improved`);
  console.log(`[report] saved as Report ${report._id}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[report] failed:", err);
  process.exit(1);
});
