import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../src/db.js";
import Agent from "../src/models/Agent.js";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// "agents" = native config-only agents built for this forest.
// "external" = unofficial prototypes inspired by popular third-party AI
// tools (see each config's `disclaimer` and `platformUrl`).
const sourceDirs = [path.join(__dirname, "agents"), path.join(__dirname, "external")];

async function seed() {
  await connectDB();
  let total = 0;

  for (const dir of sourceDirs) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const config = JSON.parse(fs.readFileSync(path.join(dir, file), "utf-8"));
      await Agent.findOneAndUpdate(
        { slug: config.slug },
        { $set: config },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`[seed] upserted ${config.slug}`);
      total += 1;
    }
  }

  console.log(`[seed] done — ${total} agents loaded`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
