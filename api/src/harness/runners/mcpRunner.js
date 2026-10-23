import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { assertHostIsSafe } from "../safeFetch.js";

// Runs one task against an mcp-type agent: connects to its MCP server,
// calls the first tool listed in the task's toolsAllowed (or the server's
// only tool, if it has just one) with the task input as its argument, and
// maps the result into the same internal event shape httpRunner produces
// so grading/scoring never need to know which runner ran.
//
// SSRF note: assertHostIsSafe rejects an unsafe endpoint before connecting,
// but the MCP SDK manages its own HTTP client internally, so (unlike
// httpRunner) the connection isn't IP-pinned against DNS rebinding after
// that check — see the comment on assertHostIsSafe itself.
export async function runMcpTask({ manifest, task }) {
  const started = Date.now();
  const events = [];
  let finalOutput = "";
  let totalTokens = 0;

  try {
    await assertHostIsSafe(manifest.interface.endpoint);

    const transport = new StreamableHTTPClientTransport(new URL(manifest.interface.endpoint));
    const client = new Client({ name: "agent-one-harness", version: "0.1.0" }, { capabilities: {} });
    await client.connect(transport);

    events.push({ type: "step", timestamp: new Date(), tokens: 0, data: { note: "connected to MCP server" } });

    const { tools } = await client.listTools();
    const toolName = task.toolsAllowed.find((t) => tools.some((tool) => tool.name === t)) || tools[0]?.name;
    if (!toolName) throw new Error("MCP server exposes no usable tool for this task.");

    events.push({ type: "tool_call", timestamp: new Date(), tokens: 0, data: { tool: toolName, input: task.input } });

    const result = await client.callTool({ name: toolName, arguments: { input: task.input } });
    events.push({ type: "tool_result", timestamp: new Date(), tokens: 0, data: result });

    finalOutput = Array.isArray(result.content)
      ? result.content.map((c) => c.text || "").join("\n")
      : JSON.stringify(result);
    events.push({ type: "final", timestamp: new Date(), tokens: 0, data: { output: finalOutput } });

    await client.close();

    return {
      events, finalOutput, tokens: totalTokens, costUsd: 0,
      latencyMs: Date.now() - started, outcome: "ok", errorMessage: "",
    };
  } catch (err) {
    return {
      events, finalOutput, tokens: totalTokens, costUsd: 0,
      latencyMs: Date.now() - started, outcome: "error", errorMessage: err.message,
    };
  }
}
