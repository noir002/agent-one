import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import { checkAllListings } from "../src/services/freshnessCheck.js";

async function main() {
  await connectDB();
  const results = await checkAllListings();
  const ok = results.filter((r) => r.ok).length;
  console.log(`[freshness] checked ${results.length} listings — ${ok} ok, ${results.length - ok} unreachable`);
  for (const r of results.filter((r) => !r.ok)) {
    console.log(`  ✗ ${r.slug} (site: ${r.siteOk ? "ok" : "down"}, repo: ${r.repoOk ? "ok" : "down"})`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[freshness] failed:", err);
  process.exit(1);
});
