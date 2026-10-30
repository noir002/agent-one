import { loadRootEnv } from "@agentone/shared/loadEnv.js";
loadRootEnv();
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import DirectoryTool from "../src/models/DirectoryTool.js";
import { slugify } from "../src/utils/slugify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const batchArg = process.argv.find((a) => a.startsWith("--batch="));
const batch = batchArg ? Number(batchArg.split("=")[1]) : null;
if (!batch) {
  console.error("Usage: node scripts/seedDirectoryTools.js --batch=1");
  process.exit(1);
}

const dataPath = path.join(__dirname, "..", "seed", `directoryBatch${batch}.json`);

async function seed() {
  await connectDB();

  if (!fs.existsSync(dataPath)) {
    console.error(`[seed:directory] no file at ${dataPath}`);
    process.exit(1);
  }
  const entries = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  for (const entry of entries) {
    const slug = entry.slug || slugify(entry.name);
    const doc = {
      name: entry.name,
      slug,
      logoUrl: entry.logoUrl || "",
      description: entry.description,
      category: entry.category,
      basePrice: entry.basePrice || "unknown",
      useCase: entry.useCase,
      sourceUrl: entry.sourceUrl,
      demoUrl: entry.demoUrl || "",
      rankSource: entry.rankSource || "",
      rankPosition: entry.rankPosition ?? null,
      addedBatch: batch,
      "security.repoUrl": entry.repoUrl || "",
    };
    await DirectoryTool.findOneAndUpdate(
      { slug },
      { $set: doc },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`[seed:directory] upserted ${slug} (batch ${batch})`);
  }

  console.log(`[seed:directory] done — ${entries.length} tools loaded for batch ${batch}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed:directory] failed:", err);
  process.exit(1);
});
