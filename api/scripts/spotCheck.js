import { loadRootEnv } from "@agentone/shared/loadEnv.js";
loadRootEnv();
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import Listing from "../src/models/Listing.js";
import Manifest from "../src/models/Manifest.js";
import EvalRun from "../src/models/EvalRun.js";
import { executeEvalRun } from "../src/harness/runEvalRun.js";

const SAMPLE_FRACTION = 0.1;
const GAP_THRESHOLD = 20; // score points

// Anti-gaming: "re-run 10% of L2 agents at random times each week. A big
// gap from their last score triggers a review." Cron-ready, same pattern
// as freshnessCheck.js — runs synchronously (not through BullMQ) since
// it's a standalone scheduled job, not a user-triggered request.
async function main() {
  await connectDB();

  const eligible = await Listing.find({
    tier: { $in: ["L2", "L3"] },
    manifestId: { $ne: null },
  }).select("_id slug name score manifestId");

  const sampleSize = Math.max(1, Math.round(eligible.length * SAMPLE_FRACTION));
  const sample = [...eligible].sort(() => Math.random() - 0.5).slice(0, sampleSize);

  console.log(`[spotcheck] sampling ${sample.length} of ${eligible.length} L2/L3 listings`);

  for (const listing of sample) {
    const previousScore = listing.score;
    const manifest = await Manifest.findById(listing.manifestId);
    if (!manifest) {
      console.log(`[spotcheck] ${listing.slug}: manifest missing, skipping`);
      continue;
    }

    const evalRun = await EvalRun.create({
      listingId: listing._id,
      manifestId: manifest._id,
      manifestVersion: manifest.version,
      triggeredBy: null, // system-triggered
      status: "queued",
    });

    try {
      const { score: newScore } = await executeEvalRun(evalRun._id);
      const gap = previousScore == null ? null : Math.abs(newScore - previousScore);

      if (gap != null && gap >= GAP_THRESHOLD) {
        await Listing.findByIdAndUpdate(listing._id, {
          scoreGapFlag: { at: new Date(), previousScore, newScore, gap },
        });
        console.log(`[spotcheck] ${listing.slug}: FLAGGED — ${previousScore} -> ${newScore} (gap ${gap.toFixed(1)})`);
      } else {
        console.log(`[spotcheck] ${listing.slug}: ${previousScore ?? "—"} -> ${newScore} (ok)`);
      }
    } catch (err) {
      console.error(`[spotcheck] ${listing.slug}: eval failed — ${err.message}`);
    }
  }

  console.log("[spotcheck] done");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[spotcheck] failed:", err);
  process.exit(1);
});
