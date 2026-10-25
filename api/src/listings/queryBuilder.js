// The filter/sort logic behind the public listings search — used by both
// routes/listings.js's `GET /` (human browsing) and the MCP server's
// `search_agents` tool (Phase 7, agent-readable directory), so an outside
// assistant searching the directory sees exactly the same results a human
// would get from the same query. Extracted rather than duplicated.
export const PUBLIC_LISTING_FIELDS = "slug name type category tier tagline description pricing openSource "
  + "interfaceType sourceUrl repoUrl logoUrl status isFlagship isSponsored lastVerifiedAt "
  + "lastCheckStatus score scoreParts createdAt";

export function buildListingFilter(params = {}) {
  const { q, category, tier, type, pricing, interfaceType, openSource, section, sort } = params;

  const filter = { status: "active" };
  if (category) filter.category = category;
  if (tier) filter.tier = tier;
  if (type) filter.type = type;
  if (pricing) filter.pricing = pricing;
  if (interfaceType) filter.interfaceType = interfaceType;
  if (openSource === true || openSource === "true") filter.openSource = true;
  if (q) filter.$text = { $search: String(q) };

  if (section === "new") {
    // "New this week"
    filter.createdAt = { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
  } else if (section === "recently-verified") {
    filter.lastVerifiedAt = { $ne: null };
  }

  if (sort === "score") {
    // Conflict of interest: Agent One's own flagships are never ranked
    // against outside agents, per the HLD's anti-gaming rule.
    filter.isFlagship = { $ne: true };
  }

  return filter;
}

export function buildListingSort(params = {}) {
  const { sort, section } = params;
  if (sort === "score") return { score: -1, lastVerifiedAt: -1 };
  if (sort === "new") return { createdAt: -1 };
  if (section === "recently-verified") return { lastVerifiedAt: -1 };
  // Default: tier (higher first), then freshness — stale listings sink.
  return { tier: -1, lastVerifiedAt: -1, name: 1 };
}
