import crypto from "node:crypto";
import { safeFetchStream } from "../safeFetch.js";

const MAX_LINE_BYTES = 200_000; // a single SSE line this long is almost certainly abuse, not data

// Runs one task against an http-type agent's declared endpoint via the
// Task API: POST {task_id, input, files, tools_allowed, budget}, consume
// the SSE event stream (step/tool_call/tool_result/message/final).
// Every event the agent sends is recorded verbatim into the trace — this
// becomes the public run page once share loops exist (Phase 6).
export async function runHttpTask({ manifest, task, authToken }) {
  const started = Date.now();
  const taskId = crypto.randomUUID();
  const body = JSON.stringify({
    task_id: taskId,
    input: task.input,
    files: [],
    tools_allowed: task.toolsAllowed,
    budget: task.budget,
  });

  const headers = { "Content-Type": "application/json", Accept: "text/event-stream" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const { status, stream } = await safeFetchStream(manifest.interface.endpoint, {
    method: "POST",
    headers,
    body,
    timeoutMs: (task.budget.timeoutS || 120) * 1000,
  });

  if (status >= 400) {
    stream.destroy();
    return {
      events: [],
      finalOutput: "",
      tokens: 0,
      costUsd: 0,
      latencyMs: Date.now() - started,
      outcome: "error",
      errorMessage: `Agent endpoint returned HTTP ${status}.`,
    };
  }

  const events = [];
  let finalOutput = "";
  let totalTokens = 0;
  let totalCost = 0;
  let stepCount = 0;
  let errorMessage = "";

  let buffer = "";
  let currentEvent = "";

  try {
    for await (const chunk of stream) {
      buffer += chunk.toString("utf-8");
      const lines = buffer.split("\n");
      buffer = lines.pop(); // keep the last partial line

      for (const rawLine of lines) {
        if (rawLine.length > MAX_LINE_BYTES) {
          throw new Error("SSE line exceeded the size limit.");
        }
        if (rawLine.startsWith("event:")) {
          currentEvent = rawLine.slice(6).trim();
        } else if (rawLine.startsWith("data:")) {
          const payload = rawLine.slice(5).trim();
          let data;
          try {
            data = JSON.parse(payload);
          } catch {
            data = { raw: payload };
          }
          const tokens = Number(data.tokens) || 0;
          totalTokens += tokens;
          totalCost += Number(data.cost_usd) || 0;
          events.push({ type: currentEvent || "message", timestamp: new Date(), tokens, data });

          if (currentEvent === "step") {
            stepCount += 1;
            if (stepCount > (task.budget.maxSteps || 40)) {
              stream.destroy();
              errorMessage = `Agent exceeded the step budget (${task.budget.maxSteps}).`;
              throw new Error(errorMessage);
            }
          }
          if (currentEvent === "final") {
            finalOutput = typeof data.output === "string" ? data.output : JSON.stringify(data);
          }
        }
      }
    }
  } catch (err) {
    if (!errorMessage) errorMessage = err.message;
  }

  return {
    events,
    finalOutput,
    tokens: totalTokens,
    costUsd: totalCost,
    latencyMs: Date.now() - started,
    outcome: errorMessage ? "error" : "ok",
    errorMessage,
  };
}
