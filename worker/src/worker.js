import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";

// Phase 1 stub: proves the Redis/BullMQ wiring works end to end. The real
// eval-run processor (manifest fetch, runner dispatch, grading, scoring —
// see the HLD's "Harness" phase) lands in Phase 2. Nothing is queued onto
// "eval-runs" yet, so this worker sits idle.

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

connection.on("connect", () => console.log("[worker] connected to Redis"));
connection.on("error", (err) => console.error("[worker] Redis connection error:", err.message));

const worker = new Worker("eval-runs", async (job) => {
  console.log(`[worker] received job ${job.id} (${job.name}) — no processor implemented yet (Phase 2)`);
}, { connection });

worker.on("ready", () => console.log("[worker] listening on queue \"eval-runs\""));
worker.on("failed", (job, err) => console.error(`[worker] job ${job?.id} failed:`, err.message));

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
