import { Router } from "express";
import Task from "../models/Task.js";

const router = Router();

// Public sample tasks only — "publish 5 sample tasks per suite so owners
// know the format" (we ship 3/category, see README's scope note). Hidden
// tasks, safety tasks and paraphrase content are never exposed here.
router.get("/", async (req, res) => {
  const filter = { isPublicSample: true };
  if (req.query.category) filter.category = req.query.category;
  const tasks = await Task.find(filter).select("category title input toolsAllowed budget").sort({ category: 1, title: 1 }).lean();
  res.json({ tasks });
});

export default router;
