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

  // Full sync by (category, title): tasks.json is the source of truth, so
  // anything in the DB but no longer in the file gets removed — otherwise
  // Phase 2's 4 placeholder tasks would stick around and get mixed into
  // real eval runs alongside Phase 3's real 24-task suite.
  const keep = tasks.map((t) => ({ category: t.category, title: t.title }));
  const removed = await Task.deleteMany({ $nor: keep.map((k) => ({ category: k.category, title: k.title })) });
  if (removed.deletedCount) console.log(`[seed:tasks] removed ${removed.deletedCount} task(s) no longer in tasks.json`);

  for (const task of tasks) {
    // findOneAndReplace (not $set) so re-seeding an older document — e.g.
    // one of Phase 2's 4 placeholder tasks that got reused by title here —
    // ends up with exactly the new schema's shape, including defaults for
    // fields the old document never had (activeVariant, paraphrase). $set
    // only touches fields present in the payload and leaves everything
    // else as-is, which silently left stale documents missing new fields.
    await Task.findOneAndReplace(
      { category: task.category, title: task.title },
      task,
      { upsert: true }
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
