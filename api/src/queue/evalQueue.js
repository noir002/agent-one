import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const evalQueue = new Queue("eval-runs", { connection });

export async function enqueueEvalRun(evalRunId) {
  return evalQueue.add("run-eval", { evalRunId: evalRunId.toString() }, {
    attempts: 1, // a failed run is a real result (status: "failed"), not something to silently retry
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  });
}
