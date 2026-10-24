// Connects to Agent One's own MCP server (src/routes/mcp.js) as a real MCP
// client would — not an HTTP status check — and calls all three tools.
// Run with the api dev server already up: `npm run mcp:verify`.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function main() {
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost:4000/api/mcp"));
  const client = new Client({ name: "verify-script", version: "0.1.0" }, { capabilities: {} });
  await client.connect(transport);

  const { tools } = await client.listTools();
  console.log("tools:", tools.map((t) => t.name));

  const search = await client.callTool({ name: "search_agents", arguments: { category: "code" } });
  console.log("\nsearch_agents(category=code):");
  console.log(search.content[0].text.slice(0, 500));

  const find = await client.callTool({ name: "find_agent_for_task", arguments: { task: "fix a bug in my python code" } });
  console.log("\nfind_agent_for_task:");
  console.log(find.content[0].text.slice(0, 500));

  const evidence = await client.callTool({ name: "get_agent_evidence", arguments: { slug: "aider" } });
  console.log("\nget_agent_evidence(aider):");
  console.log(evidence.content[0].text.slice(0, 500));

  const missing = await client.callTool({ name: "get_agent_evidence", arguments: { slug: "does-not-exist" } });
  console.log("\nget_agent_evidence(does-not-exist):");
  console.log(missing.content[0].text);

  await client.close();
}

main().catch((err) => {
  console.error("verify failed:", err);
  process.exit(1);
});
