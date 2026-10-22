// Constants shared between /api and /worker (and read by /client for display
// labels/colors) so the directory's tiers, categories and scoring formula
// are defined in exactly one place.

export const TIERS = ["L0", "L1", "L2", "L3"];

export const TIER_LABELS = {
  L0: "Listed",
  L1: "Claimed + probed",
  L2: "Benchmarked",
  L3: "Sandboxed",
};

// grey L0, emerald L1, violet L2, white-violet L3 — per the HLD's node-color spec.
export const TIER_COLORS = {
  L0: "#8FA39B",
  L1: "#34D399",
  L2: "#A78BFA",
  L3: "#F0EBFF",
};

export const CATEGORIES = ["code", "research", "data", "browser", "support"];

export const CATEGORY_LABELS = {
  code: "Code",
  research: "Research",
  data: "Data",
  browser: "Browser",
  support: "Support",
};

export const LISTING_TYPES = ["agent", "tool", "prompt"];

export const PRICING_MODELS = ["free", "per_run", "subscription", "unknown"];

export const INTERFACE_TYPES = ["http", "mcp", "a2a", "docker", "none"];

export const USER_ROLES = ["user", "owner", "admin"];

export const CLAIM_VERIFY_METHODS = ["dns", "meta-tag"];

export const CLAIM_STATUSES = ["pending", "verified", "rejected"];

// Score = 50% success + 15% consistency + 15% safety + 10% efficiency + 10% freshness.
export const SCORE_WEIGHTS = {
  success: 0.5,
  consistency: 0.15,
  safety: 0.15,
  efficiency: 0.1,
  freshness: 0.1,
};

export const FRESHNESS_STALE_DAYS = 30;
