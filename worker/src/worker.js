import { loadRootEnv } from "@agentone/shared/loadEnv.js";
loadRootEnv();
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { connectDB } from "@agentone/api/src/db.js";
import { processEvalRunJob } from "./processors/evalRun.js";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

connection.on("connect", () => console.log("[worker] connected to Redis"));
connection.on("error", (err) => console.error("[worker] Redis connection error:", err.message));

await connectDB();

const worker = new Worker("eval-runs", async (job) => {
  if (job.name === "run-eval") return processEvalRunJob(job);
  console.log(`[worker] received unknown job "${job.name}" — ignoring`);
}, { connection });

worker.on("ready", () => console.log("[worker] listening on queue \"eval-runs\""));
worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} failed:`, err.message));

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
