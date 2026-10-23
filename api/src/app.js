import { loadRootEnv } from "@agentone/shared/loadEnv.js";
loadRootEnv();
import express from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import { connectDB } from "./db.js";
import User from "./models/User.js";

import listingsRoutes from "./routes/listings.js";
import claimsRoutes from "./routes/claims.js";
import adminRoutes from "./routes/admin.js";
import disputesRoutes from "./routes/disputes.js";
import evalRunsRoutes from "./routes/evalRuns.js";
import tasksRoutes from "./routes/tasks.js";
import flagshipsRoutes from "./routes/flagships.js";
import authRoutes from "./routes/auth.js";
import statsRoutes from "./routes/stats.js";
import devAuthRoutes from "./auth/devAuth.js";
import { isGoogleConfigured, configureGoogleAuth } from "./auth/google.js";
import { isGitHubConfigured, configureGitHubAuth } from "./auth/github.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(cookieSession({
  name: "agentone.sid",
  secret: process.env.SESSION_SECRET || "dev-secret-change-me",
  maxAge: 30 * 24 * 60 * 60 * 1000,
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

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`[api] listening on http://localhost:${PORT}`));
}).catch((err) => {
  console.error("[api] failed to connect to MongoDB:", err.message);
  process.exit(1);
});
