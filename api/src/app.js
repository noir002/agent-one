import { loadRootEnv } from "@agentone/shared/loadEnv.js";
loadRootEnv();
import express from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import rateLimit from "express-rate-limit";
import { connectDB } from "./db.js";
import User from "./models/User.js";
import Listing from "./models/Listing.js";

import listingsRoutes from "./routes/listings.js";
import claimsRoutes from "./routes/claims.js";
import adminRoutes from "./routes/admin.js";
import disputesRoutes from "./routes/disputes.js";
import evalRunsRoutes from "./routes/evalRuns.js";
import tasksRoutes from "./routes/tasks.js";
import flagshipsRoutes from "./routes/flagships.js";
import reviewsRoutes from "./routes/reviews.js";
import runsRoutes from "./routes/runs.js";
import headToHeadRoutes from "./routes/headToHead.js";
import reportsRoutes from "./routes/reports.js";
import ogRoutes from "./routes/og.js";
import shareRoutes from "./routes/share.js";
import mcpRoutes from "./routes/mcp.js";
import authRoutes from "./routes/auth.js";
import statsRoutes from "./routes/stats.js";
import devAuthRoutes from "./auth/devAuth.js";
import { isGoogleConfigured, configureGoogleAuth } from "./auth/google.js";
import { isGitHubConfigured, configureGitHubAuth } from "./auth/github.js";
import { CATEGORY_LABELS } from "@agentone/shared";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieSession({
  name: "agentone.sid",
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  maxAge: 30 * 24 * 60 * 60 * 1000,
}));

// "Public read API with rate limits" (HLD, Phase 7) — one global limiter
// across the api surface, generous enough for normal interactive use.
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Attach req.user from session for every request.
app.use(async (req, _res, next) => {
  if (req.session?.userId) {
    req.user = await User.findById(req.session.userId);
  }
  next();
});

app.use("/api/listings", listingsRoutes);
app.use("/api/claims", claimsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/disputes", disputesRoutes);
app.use("/api", evalRunsRoutes);
app.use("/api", reviewsRoutes);
app.use("/api/runs", runsRoutes);
app.use("/api/head-to-head", headToHeadRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/og", ogRoutes);
app.use("/api/share", shareRoutes);
// Open CORS here (not the app-wide policy above) is deliberately safe: this
// route carries no cookies/session and nothing credentialed, and it exists
// specifically so outside AI assistants — not just our own SPA's origin —
// can call it (the HLD's "MCP server for 'find me a verified agent'").
app.use("/api/mcp", cors(), mcpRoutes);
app.use("/api/tasks", tasksRoutes);
app.use("/api/flagships", flagshipsRoutes);
app.use("/api/me", authRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/auth", devAuthRoutes);

if (isGoogleConfigured()) {
  app.use("/api/auth/google", configureGoogleAuth());
  console.log("[auth] Google sign-in enabled");
} else {
  console.log("[auth] Google sign-in not configured — using dev-mode login only");
}

if (isGitHubConfigured()) {
  app.use("/api/auth/github", configureGitHubAuth());
  console.log("[auth] GitHub sign-in enabled");
} else {
  console.log("[auth] GitHub sign-in not configured — using dev-mode login only");
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// llms.txt (HLD, Phase 7): the emerging robots.txt-for-LLMs convention —
// lives at the domain root, not under /api, and is generated live from real
// data rather than hand-maintained, so it never drifts.
app.get("/llms.txt", async (req, res) => {
  const apiOrigin = `${req.protocol}://${req.get("host")}`;
  const clientOrigin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

  const top = await Listing.find({ status: "active", isFlagship: { $ne: true }, score: { $ne: null } })
    .select("slug name category score")
    .sort({ score: -1 })
    .limit(10)
    .lean();

  const lines = [
    "# Agent One",
    "",
    "> Agent One is an AI agent directory where every score comes from real,",
    "> recorded test runs — not self-reported claims or vendor copy.",
    "",
    "Agents are benchmarked against hidden task suites, 3 runs per task,",
    "graded by deterministic checks and an LLM judge. Scores only ever come",
    "from a real EvalRun; nothing is scored by self-report.",
    "",
    "## For AI assistants",
    "",
    `- MCP server (search_agents, get_agent_evidence, find_agent_for_task): ${apiOrigin}/api/mcp`,
    `- Public read API: ${apiOrigin}/api/listings (filters: q, category, tier, pricing, openSource, interfaceType, sort)`,
    "",
    "## Key pages",
    "",
    `- Leaderboard: ${clientOrigin}/leaderboard`,
    `- Monthly reports: ${clientOrigin}/reports`,
    "",
    "## Top benchmarked agents right now",
    "",
    ...top.map((l) => `- ${l.name} (${CATEGORY_LABELS[l.category] || l.category}, score ${Math.round(l.score)}): ${clientOrigin}/listing/${l.slug}`),
    "",
  ];

  res.type("text/plain").send(lines.join("\n"));
});

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`));
}).catch((err) => {
  console.error("[api] failed to connect to MongoDB:", err.message);
  process.exit(1);
});
