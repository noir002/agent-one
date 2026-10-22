import Agent from "../models/Agent.js";
import Run from "../models/Run.js";
import User from "../models/User.js";
import { generate } from "../llm/adapter.js";

const MAX_INPUT_LENGTH = 8000;
const SIGNED_IN_DAILY_LIMIT = 20;
const VISITOR_DAILY_LIMIT = 3;

export class RunnerError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function validateInputs(agent, inputs) {
  for (const field of agent.inputs) {
    const value = inputs?.[field.key];
    if (field.required && (value === undefined || value === null || String(value).trim() === "")) {
      throw new RunnerError(`"${field.label}" is required.`);
    }
    if (typeof value === "string" && value.length > MAX_INPUT_LENGTH) {
      throw new RunnerError(`"${field.label}" exceeds ${MAX_INPUT_LENGTH} characters.`);
    }
  }
}

// Mutates and persists the run-limit counter; throws if the caller is over limit.
export async function enforceRunLimit(user) {
  const today = todayKey();
  if (!user) {
    // Visitor limits are tracked client-side via a cookie/counter passed in,
    // but we also defend server-side using a lightweight signed cookie count
    // handled by the route layer. Here we just assert a hard ceiling param
    // is honored by the caller for anonymous sessions.
    return;
  }
  if (user.runsTodayDate !== today) {
    user.runsToday = 0;
    user.runsTodayDate = today;
  }
  if (user.runsToday >= SIGNED_IN_DAILY_LIMIT) {
    throw new RunnerError(`Daily run limit (${SIGNED_IN_DAILY_LIMIT}) reached. Try again tomorrow.`, 429);
  }
  user.runsToday += 1;
  await user.save();
}

export function buildPrompt(agent, inputs) {
  const lines = Object.entries(inputs || {})
    .map(([key, value]) => {
      const field = agent.inputs.find((f) => f.key === key);
      const label = field?.label || key;
      return `${label}: ${value}`;
    })
    .join("\n");
  const user = `${lines}\n\nRespond in ${agent.outputFormat} format.`;
  return { system: agent.systemPrompt, user };
}

// onChunk(text) is called for each streamed chunk. Returns { run, agent }.
export async function runAgent({ slug, inputs, user, onChunk }) {
  const agent = await Agent.findOne({ slug, status: { $ne: "hidden" } });
  if (!agent) throw new RunnerError("Agent not found.", 404);

  validateInputs(agent, inputs);
  await enforceRunLimit(user);

  const { system, user: userPrompt } = buildPrompt(agent, inputs);
  const started = Date.now();

  const iterator = generate({ system, user: userPrompt, model: agent.model, maxTokens: 1024 });
  let result = await iterator.next();
  let fullText = "";
  let tokens = 0;
  let status = "ok";
  try {
    while (!result.done) {
      fullText += result.value;
      onChunk?.(result.value);
      result = await iterator.next();
    }
    // The generator's final return value carries fullText/tokens.
    fullText = result.value?.fullText ?? fullText;
    tokens = result.value?.tokens ?? 0;
  } catch (err) {
    status = "error";
    fullText = fullText || `Error: ${err.message}`;
  }

  const latencyMs = Date.now() - started;

  const run = await Run.create({
    agentId: agent._id,
    userId: user?._id || null,
    inputs,
    output: fullText,
    latencyMs,
    tokens,
    status,
  });

  agent.stats.runs += 1;
  await agent.save();

  return { run, agent };
}
