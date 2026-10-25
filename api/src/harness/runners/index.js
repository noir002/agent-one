import { runHttpTask } from "./httpRunner.js";
import { runMcpTask } from "./mcpRunner.js";
import { runA2aTask } from "./a2aStub.js";
import { runDockerTask } from "./dockerRunner.js";

const RUNNERS = { http: runHttpTask, mcp: runMcpTask, a2a: runA2aTask, docker: runDockerTask };

export function getRunner(interfaceType) {
  const runner = RUNNERS[interfaceType];
  if (!runner) throw new Error(`No runner for interface type "${interfaceType}".`);
  return runner;
}
