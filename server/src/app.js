import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieSession from "cookie-session";
import { connectDB } from "./db.js";
import User from "./models/User.js";

import forestRoutes from "./routes/forest.js";
import agentsRoutes from "./routes/agents.js";
import runsRoutes from "./routes/runs.js";
import authRoutes from "./routes/auth.js";
import devAuthRoutes from "./auth/devAuth.js";
import { isGoogleConfigured, configureGoogleAuth } from "./auth/googleAuth.js";

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

app.use("/api/forest", forestRoutes);
app.use("/api/agents", agentsRoutes);
app.use("/api/runs", runsRoutes);
app.use("/api/me", authRoutes);
app.use("/api/auth", devAuthRoutes);

if (isGoogleConfigured()) {
  app.use("/api/auth/google", configureGoogleAuth());
  console.log("[auth] Google sign-in enabled");
} else {
  console.log("[auth] Google sign-in not configured — using dev-mode login only");
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`[server] listening on http://localhost:${PORT}`));
}).catch((err) => {
  console.error("[server] failed to connect to MongoDB:", err.message);
  process.exit(1);
});
