import { Router } from "express";
import DirectoryTool from "../models/DirectoryTool.js";
import ToolRating from "../models/ToolRating.js";

const router = Router();
const PUBLIC_FIELDS = "name slug logoUrl description category basePrice useCase sourceUrl demoUrl "
  + "rankSource rankPosition addedBatch security rating createdAt";

router.get("/", async (req, res) => {
  const { category, price, batch, sort } = req.query;
  const filter = { status: "active" };
  if (category) filter.category = category;
  if (price) filter.basePrice = new RegExp(`^${price}`, "i");
  if (batch) filter.addedBatch = Number(batch);

  let query = DirectoryTool.find(filter).select(PUBLIC_FIELDS);
  if (sort === "rating") query = query.sort({ "rating.average": -1, "rating.count": -1 });
  else if (sort === "newest") query = query.sort({ createdAt: -1 });
  else query = query.sort({ addedBatch: 1, rankPosition: 1 }); // default: discovery order

  const tools = await query.limit(200).lean();
  res.json({ tools });
});

router.get("/:slug", async (req, res) => {
  const tool = await DirectoryTool.findOne({ slug: req.params.slug, status: "active" }).select(PUBLIC_FIELDS).lean();
  if (!tool) return res.status(404).json({ error: "Tool not found." });
  res.json({ tool });
});

// Login-gated, 1-5 stars — no run required first (unlike Review.js),
// since these tools have no verified connection to run against. One
// rating per user per tool; re-submitting overwrites.
router.post("/:slug/rate", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in to rate this tool." });

  const { stars, text } = req.body || {};
  const starsNum = Number(stars);
  if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
    return res.status(400).json({ error: "stars must be an integer from 1 to 5." });
  }

  const tool = await DirectoryTool.findOne({ slug: req.params.slug, status: "active" });
  if (!tool) return res.status(404).json({ error: "Tool not found." });

  await ToolRating.findOneAndUpdate(
    { toolId: tool._id, userId: req.user._id },
    { $set: { stars: starsNum, text: text || "" } },
    { upsert: true, new: true }
  );

  const agg = await ToolRating.aggregate([
    { $match: { toolId: tool._id } },
    { $group: { _id: null, avg: { $avg: "$stars" }, count: { $sum: 1 } } },
  ]);
  tool.rating = agg[0] ? { average: Number(agg[0].avg.toFixed(2)), count: agg[0].count } : { average: 0, count: 0 };
  await tool.save();

  res.status(201).json({ rating: tool.rating });
});

router.get("/:slug/ratings", async (req, res) => {
  const tool = await DirectoryTool.findOne({ slug: req.params.slug }).select("_id").lean();
  if (!tool) return res.status(404).json({ error: "Tool not found." });
  const ratings = await ToolRating.find({ toolId: tool._id })
    .populate("userId", "name")
    .sort({ createdAt: -1 })
    .lean();
  res.json({ ratings });
});

export default router;
