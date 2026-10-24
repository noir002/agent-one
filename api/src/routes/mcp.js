import { randomUUID } from "node:crypto";
import { Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createAgentOneMcpServer } from "../mcp/server.js";

const router = Router();

// MCP's streamable-HTTP transport is stateful per connection — one
// transport (and the McpServer it's attached to) per session, looked up by
// the `mcp-session-id` header on every request after the first. Same shape
// of problem mcpRunner.js already solved client-side in Phase 2 (a shared
// transport across sequential calls corrupted sessions); this is the
// server-side mirror of that fix, using the pattern the SDK itself
// documents for Express.
const sessions = new Map(); // sessionId -> transport

router.post("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  let transport = sessionId ? sessions.get(sessionId) : undefined;

  if (!transport) {
    if (sessionId) {
      return res.status(404).json({ error: "Unknown MCP session." });
    }
    if (!isInitializeRequest(req.body)) {
      return res.status(400).json({ error: "No valid session ID provided; expected an initialize request." });
    }

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => { sessions.set(sid, transport); },
    });
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    const server = createAgentOneMcpServer();
    await server.connect(transport);
  }

  await transport.handleRequest(req, res, req.body);
});

async function handleSessionRequest(req, res) {
  const sessionId = req.headers["mcp-session-id"];
  const transport = sessionId ? sessions.get(sessionId) : undefined;
  if (!transport) return res.status(400).send("Invalid or missing MCP session ID.");
  await transport.handleRequest(req, res);
}

router.get("/", handleSessionRequest);
router.delete("/", handleSessionRequest);

export default router;
