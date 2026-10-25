import { generate } from "../llm/adapter.js";
import { findAgentsForTask } from "../finder/findAgentsForTask.js";

async function collectFullText(iterator) {
  let result = await iterator.next();
  let text = "";
  while (!result.done) {
    text += result.value;
    result = await iterator.next();
  }
  return result.value?.fullText ?? text;
}

function formatMatches(matches) {
  return matches.map((m, i) => {
    const lines = [`${i + 1}. ${m.name} (${m.category}, tier ${m.tier}) — score ${Math.round(m.score)}/100`];
    if (m.tagline) lines.push(`   ${m.tagline}`);
    if (m.evidenceRunId) lines.push(`   Evidence: /runs/task/${m.evidenceRunId}`);
    return lines.join("\n");
  }).join("\n\n");
}

// Agent Finder's real loop: understand the task → search verified agents →
// compare scores and traces → recommend (HLD). Unlike Repo Fixer/Cited
// Researcher, selection never needs an LLM — findAgentsForTask ranks by
// real search relevance + real recorded score, which is never fake. An LLM
// call (when a real key is configured) only narrates an already-fixed
// list; it can never reorder or invent agents — that's what keeps this
// compliant with the HLD's "no payment, plan or sponsorship may change...
// Agent Finder result" rule by construction, not by trusting the model.
export async function runAgentFinder({ input, llmOverride }) {
  const events = [];
  const emit = (event, data) => events.push({ event, data });

  emit("step", { note: "understanding the task", tokens: 0 });
  emit("tool_call", { tool: "agentone.search_verified_agents", input });
  const matches = await findAgentsForTask(input);
  emit("tool_result", { count: matches.length, slugs: matches.map((m) => m.slug) });

  if (matches.length === 0) {
    const finalOutput = "No benchmarked agents are available yet to recommend — check back once more listings have real eval runs.";
    emit("final", { output: finalOutput, tokens: 0, cost_usd: 0 });
    return { events, finalOutput, matches };
  }

  const structuredLines = formatMatches(matches);
  let finalOutput = `Based on real, recorded test runs, here are the best-matching verified agents:\n\n${structuredLines}`;

  // Mirrors adapter.js's own provider resolution so this matches exactly
  // what generate() would actually do, without calling it just to check.
  const provider = (llmOverride?.provider || process.env.LLM_PROVIDER || "mock").toLowerCase();
  if (provider !== "mock") {
    emit("message", { text: "writing a short recommendation", tokens: 0 });
    const prompt = [
      `A user asked for help with this task: "${input}"`,
      "",
      "Here are the top matching agents, with their real Agent One benchmark scores. Never change this ranking or invent agents not listed:",
      structuredLines,
      "",
      "Write 2-3 sentences recommending from this list, referencing the real scores.",
    ].join("\n");
    const narration = await collectFullText(generate({
      system: "You explain which verified agent fits a task, using only the real data given. Never invent agents or scores, and never reorder the given ranking.",
      user: prompt,
      model: "default",
      maxTokens: 300,
      ...llmOverride,
    }));
    finalOutput = `${narration}\n\n${structuredLines}`;
  }

  emit("final", { output: finalOutput, tokens: 0, cost_usd: 0 });
  return { events, finalOutput, matches };
}

export async function handleAgentFinderRun(req, res) {
  const { input } = req.body || {};

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const { events } = await runAgentFinder({ input: input || "", llmOverride: req.llmOverride });
    for (const e of events) send(e.event, e.data);
  } catch (err) {
    send("final", { output: `Error: ${err.message}`, tokens: 0 });
  }
  res.end();
}
