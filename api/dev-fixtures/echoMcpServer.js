// Same purpose as echoAgent.js, but exposed over MCP instead of plain HTTP,
// to prove the mcp runner works too. Run with `npm run fixture:echo-mcp`.
import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

const PORT = process.env.FIXTURE_MCP_PORT || 4101;

const CANNED_ANSWERS = [
  { match: /add\(a, b\)/i, output: "def add(a, b):\n    return a + b" },
  { match: /off-by-one/i, output: "Change `range(11)` to `range(10)`: `for i in range(10): print(i)`" },
  { match: /retrieval-augmented generation/i, output: "RAG differs from a standard LLM by retrieving relevant documents at query time and conditioning generation on them. See Lewis et al. (2020)." },
  { match: /REST APIs and GraphQL/i, output: "REST exposes fixed endpoints; GraphQL lets a client request exactly the fields it needs in one round trip, trading server-side complexity for less bandwidth." },
];

function pickAnswer(input) {
  const match = CANNED_ANSWERS.find((c) => c.match.test(input));
  return match ? match.output : "I don't have a canned answer for this task.";
}

function buildServer() {
  const server = new McpServer({ name: "echo-mcp-fixture", version: "0.1.0" });
  server.registerTool(
    "solve",
    {
      title: "Solve a task",
      description: "Answers a single task-style prompt with a canned response, for harness testing.",
      inputSchema: { input: z.string() },
    },
    async ({ input }) => ({ content: [{ type: "text", text: pickAnswer(input) }] })
  );
  return server;
}

const app = express();
app.use(express.json());

// The harness runs each task 3x, and each run opens its own MCP client
// session — so this fixture needs real multi-session support, not just one
// shared transport (that only works for a single concurrent session; a
// second client's handshake corrupts the first's). This is the standard
// session-per-transport pattern from the MCP SDK's stateful-server example.
const transportsBySession = {};

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  let transport = sessionId && transportsBySession[sessionId];

  if (!transport && isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => { transportsBySession[sid] = transport; },
    });
    transport.onclose = () => {
      if (transport.sessionId) delete transportsBySession[transport.sessionId];
    };
    const server = buildServer();
    await server.connect(transport);
  } else if (!transport) {
    res.status(400).json({ jsonrpc: "2.0", error: { code: -32000, message: "No active session and not an initialize request." }, id: null });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => console.log(`[fixture] echo MCP server listening on http://localhost:${PORT}/mcp`));
