import { Router } from "express";
import Agent from "../models/Agent.js";
import User from "../models/User.js";

const router = Router();

router.get("/", async (_req, res) => {
  const [agentsCount, creatorsCount, verifiedCount, agents] = await Promise.all([
    Agent.countDocuments({ status: { $ne: "hidden" } }),
    User.countDocuments({ role: "builder" }),
    Agent.countDocuments({ status: "verified" }),
    Agent.find({ status: { $ne: "hidden" } }).select("stats.runs").lean(),
  ]);

  const runsCount = agents.reduce((sum, a) => sum + (a.stats?.runs || 0), 0);
  const verifiedShare = agentsCount ? Math.round((verifiedCount / agentsCount) * 100) : 0;

  res.json({ agentsCount, creatorsCount, runsCount, verifiedShare });
});

export default router;
