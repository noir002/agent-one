import Listing from "../models/Listing.js";
import EvalRun from "../models/EvalRun.js";
import TaskRun from "../models/TaskRun.js";

const LIMIT = 3;

// The selection logic behind Agent Finder and the MCP `find_agent_for_task`
// tool (Phase 7) — the HLD requires both to "use the same API", so this is
// the one function both call. Deliberately has no LLM in the loop: ranking
// is a pure function of real search relevance + real recorded score, never
// something a payment, plan or sponsorship could reorder (the HLD's
// anti-gaming rule explicitly names "Agent Finder result"). The HLD also
// says "searches verified listings" — restricted to listings with a real
// score (L2/L3), never an untested L0/L1 one.
export async function findAgentsForTask(taskDescription) {
  const base = { status: "active", isFlagship: { $ne: true }, score: { $ne: null } };

  // A $meta textScore projection must use its own field name — reusing
  // "score" would collide with the real Listing.score field selected
  // alongside it.
  let candidates = await Listing.find({ ...base, $text: { $search: taskDescription } })
    .select({ slug: 1, name: 1, category: 1, tier: 1, score: 1, scoreParts: 1, tagline: 1, textScore: { $meta: "textScore" } })
    .sort({ textScore: { $meta: "textScore" } })
    .limit(LIMIT)
    .lean();

  // No text match for this wording — fall back to the best real scores
  // overall rather than returning nothing.
  if (candidates.length === 0) {
    candidates = await Listing.find(base)
      .select("slug name category tier score scoreParts tagline")
      .sort({ score: -1 })
      .limit(LIMIT)
      .lean();
  }

  const withEvidence = await Promise.all(candidates.map(async (listing) => {
    const evalRun = await EvalRun.findOne({ listingId: listing._id, status: "done" }).sort({ completedAt: -1 }).select("_id").lean();
    const passingRun = evalRun
      ? await TaskRun.findOne({ evalRunId: evalRun._id, outcome: "pass" }).select("_id").lean()
      : null;
    return { ...listing, evidenceRunId: passingRun?._id || null };
  }));

  return withEvidence;
}
