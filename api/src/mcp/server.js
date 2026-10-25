import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import Listing from "../models/Listing.js";
import { PUBLIC_LISTING_FIELDS, buildListingFilter, buildListingSort } from "../listings/queryBuilder.js";
import { findAgentsForTask } from "../finder/findAgentsForTask.js";
import { getAgentEvidence } from "../finder/getAgentEvidence.js";
import { CATEGORIES, TIERS, PRICING_MODELS } from "@agentone/shared";

function jsonResult(data) {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

// Agent One's own MCP server — "find me a verified agent" for ChatGPT,
// Claude, Perplexity and other assistants (HLD). A fresh McpServer is built
// per session (see routes/mcp.js) since the SDK ties one server instance to
// one transport/connection; the three tools below are the only state that
// matters, and they're all pure reads against the same live data the human
// directory uses.
export function createAgentOneMcpServer() {
  const server = new McpServer({ name: "agent-one", version: "1.0.0" });

  server.registerTool(
    "search_agents",
    {
      title: "Search Agent One's directory",
      description: "Search Agent One's agent directory with the same filters the human site uses — text query, category, tier, pricing, open-source. Every result is a listing with its real tier and (if benchmarked) its real recorded score; nothing here is self-reported.",
      inputSchema: {
        q: z.string().optional().describe("Free-text search across name/tagline/description."),
        category: z.enum(CATEGORIES).optional(),
        tier: z.enum(TIERS).optional().describe("L0=listed, L1=claimed+probed, L2=benchmarked, L3=sandboxed."),
        pricing: z.enum(PRICING_MODELS).optional(),
        openSource: z.boolean().optional(),
        sort: z.enum(["score", "new"]).optional().describe("'score' excludes Agent One's own flagships and requires a real benchmark score."),
      },
    },
    async (params) => {
      const filter = buildListingFilter(params);
      const sort = buildListingSort(params);
      const listings = await Listing.find(filter).select(PUBLIC_LISTING_FIELDS).sort(sort).limit(25).lean();
      return jsonResult({ listings });
    }
  );

  server.registerTool(
    "get_agent_evidence",
    {
      title: "Get the evidence behind an agent's score",
      description: "Given a listing's slug, returns its real score/tier breakdown plus links to actual recorded run pages (benchmark runs and quick runs) that back it up — not just the number.",
      inputSchema: {
        slug: z.string().describe("The listing's slug, e.g. 'aider'."),
      },
    },
    async ({ slug }) => {
      const result = await getAgentEvidence(slug);
      if (!result) return jsonResult({ error: `No listing found for slug "${slug}".` });
      return jsonResult(result);
    }
  );

  server.registerTool(
    "find_agent_for_task",
    {
      title: "Recommend verified agents for a task",
      description: "Given a task description, searches only verified (benchmarked) listings and recommends up to 3, ranked purely by real search relevance and real recorded score — never influenced by payment, plan or sponsorship. Each recommendation includes a link to real evidence.",
      inputSchema: {
        task: z.string().describe("A description of what the user needs an agent to do."),
      },
    },
    async ({ task }) => {
      const matches = await findAgentsForTask(task);
      return jsonResult({ matches });
    }
  );

  return server;
}
