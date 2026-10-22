import { Router } from "express";
import Agent from "../models/Agent.js";
import User from "../models/User.js";
import { badgeFor } from "../scoring/score.js";

const router = Router();

router.get("/", async (req, res) => {
  const { college } = req.query;

  const topAgentsRaw = await Agent.find({ status: { $ne: "hidden" } })
    .sort({ score: -1 })
    .limit(10)
    .select("slug name grove score status stats isExternal")
    .lean();
  const topAgents = topAgentsRaw.map((a) => ({ ...a, badge: badgeFor(a) }));

  const builderMatch = { authorId: { $ne: null } };
  let builderIds = null;
  if (college) {
    const usersInCollege = await User.find({ college }).select("_id").lean();
    builderIds = usersInCollege.map((u) => u._id);
    builderMatch.authorId = { $in: builderIds };
  }

  const topBuildersAgg = await Agent.aggregate([
    { $match: builderMatch },
    { $group: { _id: "$authorId", totalRuns: { $sum: "$stats.runs" }, agentCount: { $sum: 1 } } },
    { $sort: { totalRuns: -1 } },
    { $limit: 10 },
  ]);

  const builderUsers = await User.find({ _id: { $in: topBuildersAgg.map((b) => b._id) } })
    .select("name college")
    .lean();
  const userById = Object.fromEntries(builderUsers.map((u) => [u._id.toString(), u]));

  const topBuilders = topBuildersAgg.map((b) => ({
    userId: b._id,
    name: userById[b._id?.toString()]?.name || "Unknown",
    college: userById[b._id?.toString()]?.college || "",
    totalRuns: b.totalRuns,
    agentCount: b.agentCount,
  }));

  res.json({ topAgents, topBuilders });
});

export default router;
