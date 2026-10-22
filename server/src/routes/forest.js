import { Router } from "express";
import Agent from "../models/Agent.js";
import { badgeFor } from "../scoring/score.js";

const router = Router();

router.get("/", async (_req, res) => {
  const agents = await Agent.find({ status: { $ne: "hidden" } })
    .select("slug name grove tagline score status stats isExternal")
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
      isExternal: agent.isExternal,
    });
  }

  res.json({
    groves: Object.entries(groves).map(([grove, agents]) => ({ grove, agents })),
  });
});

export default router;
