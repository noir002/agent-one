import { Router } from "express";
import Report from "../models/Report.js";

const router = Router();

router.get("/", async (_req, res) => {
  const reports = await Report.find().select("month generatedAt totalBenchmarked").sort({ month: -1 }).lean();
  res.json({ reports });
});

router.get("/:month", async (req, res) => {
  const report = await Report.findOne({ month: req.params.month }).lean();
  if (!report) return res.status(404).json({ error: "No report for that month." });
  res.json({ report });
});

export default router;
