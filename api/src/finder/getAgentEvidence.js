import Listing from "../models/Listing.js";
import EvalRun from "../models/EvalRun.js";
import TaskRun from "../models/TaskRun.js";
import QuickRun from "../models/QuickRun.js";

const RUNS_PER_SOURCE = 3;

// "Compares scores and traces" (HLD) — the evidence behind a listing's
// score, shaped for a machine caller (MCP `get_agent_evidence`) or a human
// (a future "why this score" view): not just the number, but real run-page
// links (Phase 6) an assistant or a person can independently check.
export async function getAgentEvidence(slug) {
  const listing = await Listing.findOne({ slug, status: "active" })
    .select("slug name tier score scoreParts isFlagship").lean();
  if (!listing) return null;

  // isPrivate: false — this should reflect the evidence behind the
  // listing's *public* score, which a private EvalRun (Phase 8) never
  // published; its TaskRuns also 404 on the public run-page route for
  // anyone but the owner/admin, so handing them out here would be a dead
  // end for everyone else.
  const evalRun = await EvalRun.findOne({ listingId: listing._id, status: "done", isPrivate: false }).sort({ completedAt: -1 }).select("_id completedAt manifestVersion").lean();

  const taskRuns = evalRun
    ? await TaskRun.find({ evalRunId: evalRun._id }).select("_id outcome").sort({ createdAt: -1 }).limit(RUNS_PER_SOURCE).lean()
    : [];
  const quickRuns = await QuickRun.find({ listingId: listing._id }).select("_id status").sort({ createdAt: -1 }).limit(RUNS_PER_SOURCE).lean();

  return {
    listing,
    manifestVersion: evalRun?.manifestVersion || null,
    lastBenchmarkedAt: evalRun?.completedAt || null,
    evidence: [
      ...taskRuns.map((r) => ({ type: "benchmark_run", outcome: r.outcome, path: `/runs/task/${r._id}` })),
      ...quickRuns.map((r) => ({ type: "quick_run", outcome: r.status, path: `/runs/quick/${r._id}` })),
    ],
  };
}
