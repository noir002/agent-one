import { Router } from "express";
import Agent from "../models/Agent.js";

const router = Router();
const SIGNED_IN_DAILY_LIMIT = 20;
const VISITOR_DAILY_LIMIT = 3;

router.get("/", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  if (!req.user) {
    const visitorRuns = req.session.visitorRunsDate === today ? (req.session.visitorRuns || 0) : 0;
    return res.json({
      user: null,
      runsLeftToday: Math.max(0, VISITOR_DAILY_LIMIT - visitorRuns),
    });
  }
  const runsToday = req.user.runsTodayDate === today ? req.user.runsToday : 0;
  const myAgents = await Agent.find({ authorId: req.user._id }).select("slug name score status").lean();
  res.json({
    user: { id: req.user._id, name: req.user.name, role: req.user.role, email: req.user.email || null },
    runsLeftToday: Math.max(0, SIGNED_IN_DAILY_LIMIT - runsToday),
    myAgents,
  });
});

export default router;
