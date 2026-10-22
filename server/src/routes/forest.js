import { Router } from "express";
import Agent from "../models/Agent.js";

const router = Router();

function badgeFor(agent) {
  if (agent.score >= 85) return "verified";
  if (agent.score >= 60 && agent.stats.runs >= 20) return "growing";
  return "seedling";
}

router.get("/", async (_req, res) => {
  const agents = await Agent.find({ status: { $ne: "hidden" } })
    .select("slug name grove tagline score status stats")
    .lean();

  const groves = {};
  for (const agent of agents) {
    if (!groves[agent.grove]) groves[agent.grove] = [];
    groves[agent.grove].push({
      slug: agent.slug,
      name: agent.name,
      tagline: agent.tagline,
      score: agent.score,
      badge: badgeFor(agent),
    });
  }

  res.json({
    groves: Object.entries(groves).map(([grove, agents]) => ({ grove, agents })),
  });
});

export default router;
