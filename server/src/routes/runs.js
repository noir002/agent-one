import { Router } from "express";
import Run from "../models/Run.js";
import Agent from "../models/Agent.js";

const router = Router();

router.get("/:shareId", async (req, res) => {
  const run = await Run.findOne({ shareId: req.params.shareId }).lean();
  if (!run) return res.status(404).json({ error: "Run not found." });
  const agent = await Agent.findById(run.agentId).select("slug name grove tagline").lean();
  res.json({ run, agent });
});

export default router;
