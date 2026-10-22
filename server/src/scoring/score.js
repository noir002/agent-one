import Check from "../models/Check.js";
import Rating from "../models/Rating.js";
import Run from "../models/Run.js";

// Score = 40*P + 30*((R-1)/4)*C + 20*S + 10*F
// P = share of test cases passed on the latest check run (0 if never checked)
// R = average star rating (1-5); C = confidence = min(ratings/20, 1)
// S = share of runs that finished without error/timeout (1 if no runs yet)
// F = 1 if the latest check found no safety flags, else 0 (1 if never checked —
//     nothing to flag yet, so it shouldn't drag down an unreviewed seedling)
export async function computeScore(agentId) {
  const latestCheck = await Check.findOne({ agentId }).sort({ ranAt: -1 }).lean();

  const P = latestCheck && latestCheck.results.length
    ? latestCheck.results.filter((r) => r.pass).length / latestCheck.results.length
    : 0;
  const F = latestCheck ? (latestCheck.safetyFlags.length === 0 ? 1 : 0) : 1;

  const ratings = await Rating.find({ agentId }).select("stars").lean();
  const ratingCount = ratings.length;
  const R = ratingCount ? ratings.reduce((sum, r) => sum + r.stars, 0) / ratingCount : 1;
  const C = Math.min(ratingCount / 20, 1);

  const totalRuns = await Run.countDocuments({ agentId });
  const okRuns = totalRuns ? await Run.countDocuments({ agentId, status: "ok" }) : 0;
  const S = totalRuns ? okRuns / totalRuns : 1;

  const score = 40 * P + 30 * ((R - 1) / 4) * C + 20 * S + 10 * F;

  return {
    score: Math.round(Math.max(0, Math.min(100, score)) * 10) / 10,
    passRate: Math.round(P * 100) / 100,
    avgRating: Math.round(R * 10) / 10,
    runs: totalRuns,
  };
}

export function badgeFor(agent) {
  if (agent.score >= 85 && agent.status === "verified") return "verified";
  if (agent.score >= 60 && agent.stats.runs >= 20) return "growing";
  return "seedling";
}
