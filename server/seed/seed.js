import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "../src/db.js";
import Agent from "../src/models/Agent.js";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const agentsDir = path.join(__dirname, "agents");

async function seed() {
  await connectDB();
  const files = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const config = JSON.parse(fs.readFileSync(path.join(agentsDir, file), "utf-8"));
    await Agent.findOneAndUpdate(
      { slug: config.slug },
      { $set: config },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`[seed] upserted ${config.slug}`);
  }

  console.log(`[seed] done — ${files.length} agents loaded`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
