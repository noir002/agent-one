import { Router } from "express";
import Dispute from "../models/Dispute.js";

const router = Router();

// Public disputes page — "decisions logged on a public page" per the HLD.
router.get("/", async (_req, res) => {
  const disputes = await Dispute.find()
    .populate("listingId", "slug name")
    .select("listingId reason status resolution resolvedAt createdAt")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ disputes });
});

export default router;
