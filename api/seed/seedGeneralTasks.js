import { loadRootEnv } from "@agentone/shared/loadEnv.js";
loadRootEnv();
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import Task from "../src/models/Task.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Separate from seedTasks.js/tasks.json on purpose: this is the deterministic-
// only smoke-test suite for self-service repo submissions (Phase B of the
// repo-sandbox feature), not part of the real benchmarked code/research
// catalogue. Sync is scoped to category "general" only — never touches or
// deletes any code/research task.
async function seed() {
  await connectDB();
  const tasks = JSON.parse(fs.readFileSync(path.join(__dirname, "generalTasks.json"), "utf-8"));

  const keepTitles = tasks.map((t) => t.title);
  const removed = await Task.deleteMany({ category: "general", title: { $nin: keepTitles } });
  if (removed.deletedCount) console.log(`[seed:generalTasks] removed ${removed.deletedCount} task(s) no longer in generalTasks.json`);

  for (const task of tasks) {
    await Task.findOneAndReplace(
      { category: "general", title: task.title },
      task,
      { upsert: true }
    );
    console.log(`[seed:generalTasks] upserted general/${task.title}`);
  }

  console.log(`[seed:generalTasks] done — ${tasks.length} tasks loaded`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed:generalTasks] failed:", err);
  process.exit(1);
});
