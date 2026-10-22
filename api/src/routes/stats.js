import { Router } from "express";
import Listing from "../models/Listing.js";

const router = Router();

router.get("/", async (_req, res) => {
  const [agentsListed, agentsTested] = await Promise.all([
    Listing.countDocuments({ status: "active" }),
    Listing.countDocuments({ status: "active", tier: { $in: ["L2", "L3"] } }),
  ]);
  // "Runs this week" is populated once the eval harness (Phase 2) exists.
  res.json({ agentsListed, agentsTested, runsThisWeek: 0 });
});

export default router;
