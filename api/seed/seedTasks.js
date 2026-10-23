import { loadRootEnv } from "@agentone/shared/loadEnv.js";
loadRootEnv();
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import Task from "../src/models/Task.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function seed() {
  await connectDB();
  const tasks = JSON.parse(fs.readFileSync(path.join(__dirname, "tasks.json"), "utf-8"));

  // Idempotent by (category, title) rather than a dedicated slug — Phase 2
  // only has 4 hand-written tasks, so this is enough to avoid duplicates on
  // re-seed without adding a field Phase 3's real suite doesn't need either.
  for (const task of tasks) {
    await Task.findOneAndUpdate(
      { category: task.category, title: task.title },
      { $set: task },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`[seed:tasks] upserted ${task.category}/${task.title}`);
  }

  console.log(`[seed:tasks] done — ${tasks.length} tasks loaded`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed:tasks] failed:", err);
  process.exit(1);
});
