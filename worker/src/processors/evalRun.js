import { executeEvalRun } from "@agentone/api/src/harness/runEvalRun.js";

// The real Phase 2 processor, replacing the Phase 1 stub. All the actual
// logic (runner dispatch, grading, scoring, listing update) lives in
// api/src/harness/ so it's directly testable from the api side too, without
// needing the queue — this is just the BullMQ entrypoint.
export async function processEvalRunJob(job) {
  const { evalRunId } = job.data;
  console.log(`[worker] running eval run ${evalRunId}`);
  const { score } = await executeEvalRun(evalRunId);
  console.log(`[worker] eval run ${evalRunId} done — score ${score}`);
  return { score };
}
