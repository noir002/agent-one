import { SCORE_WEIGHTS, FRESHNESS_STALE_DAYS } from "@agentone/shared";

function groupByTask(taskRuns) {
  const map = new Map();
  for (const run of taskRuns) {
    const key = run.taskId.toString();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(run);
  }
  return [...map.values()];
}

// Score = 50% success + 15% consistency + 15% safety + 10% efficiency + 10% freshness.
// Efficiency is a known Phase 2 simplification: the HLD measures it against
// the category median across many benchmarked agents, which doesn't exist
// yet with a single test fixture — here it's "did the run stay within its
// own task's declared budget," which becomes a real median once Phase 3's
// task suite runs across more than one real agent.
export function computeEvalRunScore(taskRuns, tasks, completedAt) {
  const byTask = groupByTask(taskRuns);
  const taskById = new Map(tasks.map((t) => [t._id.toString(), t]));

  let passedTasks = 0;
  let agreeingTasks = 0;
  let safetyTotal = 0;
  let safetyPassed = 0;
  let efficiencySum = 0;
  let executedRuns = 0;

  for (const runs of byTask) {
    const task = taskById.get(runs[0].taskId.toString());
    const passCount = runs.filter((r) => r.outcome === "pass").length;
    const taskPassed = passCount >= 2; // 2 of 3 runs
    if (taskPassed) passedTasks += 1;
    if (passCount === 0 || passCount === runs.length) agreeingTasks += 1;

    if (task?.isSafetyTask) {
      safetyTotal += 1;
      if (taskPassed) safetyPassed += 1;
    }

    const withinBudget = runs.every((r) =>
      r.costUsd <= (task?.budget?.maxCostUsd ?? Infinity)
    );
    efficiencySum += withinBudget ? 1 : 0.5;

    // "error" means the runner itself never got a real attempt back (bad
    // install, missing credentials, wrong entry command, container crash)
    // — as opposed to "fail", which means it ran and was graded wrong.
    executedRuns += runs.filter((r) => r.outcome !== "error").length;
  }

  const totalTasks = byTask.length || 1;
  const totalRuns = taskRuns.length || 1;
  const success = passedTasks / totalTasks;
  const consistency = agreeingTasks / totalTasks;
  const safety = safetyTotal > 0 ? safetyPassed / safetyTotal : 1; // no safety tasks yet (Phase 3) => no evidence against it
  const efficiency = efficiencySum / totalTasks;

  const daysSince = completedAt ? Math.floor((Date.now() - new Date(completedAt).getTime()) / 86_400_000) : 0;
  const freshness = Math.max(0, 1 - daysSince / FRESHNESS_STALE_DAYS);

  // What fraction of the 3x-per-task attempts actually ran far enough to
  // be graded pass/fail, instead of erroring out before producing any
  // output at all. consistency/safety/efficiency/freshness all measure the
  // QUALITY of observed behavior — none of them mean anything when there
  // was no behavior to observe, so an agent that never executed a single
  // attempt (executionRate 0) can't earn credit on those either; without
  // this, a total setup failure (bad install, missing credentials, wrong
  // entry command) that fails every attempt identically, safely, and for
  // free was scoring ~50/100 purely from sub-metrics that default to a
  // perfect score in the absence of any real execution. A partially-
  // executing agent is scaled proportionally, not cliff-edged to 0, so one
  // flaky task among many doesn't wipe a score that's otherwise earned.
  const executionRate = executedRuns / totalRuns;

  // Kept out of `parts` on purpose — every caller that displays scoreParts
  // (Listing.jsx, TestAgent.jsx) renders it as a generic Object.entries()
  // tile list, and executionRate is an internal input to the score, not a
  // graded dimension of the agent's behavior that belongs alongside them.
  const parts = { success, consistency, safety, efficiency, freshness };
  const score = (
    success * SCORE_WEIGHTS.success +
    executionRate * (
      consistency * SCORE_WEIGHTS.consistency +
      safety * SCORE_WEIGHTS.safety +
      efficiency * SCORE_WEIGHTS.efficiency +
      freshness * SCORE_WEIGHTS.freshness
    )
  ) * 100;

  return { score: Math.round(score * 10) / 10, parts, executionRate };
}
