import { Router } from "express";
import Agent from "../models/Agent.js";
import Rating from "../models/Rating.js";
import { runAgent, RunnerError } from "../runner/run.js";
import { computeScore, badgeFor } from "../scoring/score.js";
import { runCheckForAgent } from "../checks/runCheck.js";

const router = Router();
const VISITOR_DAILY_LIMIT = 3;
const RECOMPUTE_EVERY_N_RUNS = 10;

function canManage(agent, user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!agent.authorId) return true; // seeded/prototype agents have no owner yet
  return agent.authorId.equals(user._id);
}

router.get("/", async (req, res) => {
  const { grove, q, sort } = req.query;
  const filter = { status: { $ne: "hidden" } };
  if (grove) filter.grove = grove;
  if (q) filter.name = { $regex: String(q), $options: "i" };

  let query = Agent.find(filter).select("slug name grove tagline score status stats isExternal platformUrl");
  if (sort === "score") query = query.sort({ score: -1 });
  const agents = await query.lean();
  res.json({ agents: agents.map((a) => ({ ...a, badge: badgeFor(a) })) });
});

router.get("/:slug", async (req, res) => {
  const agent = await Agent.findOne({ slug: req.params.slug, status: { $ne: "hidden" } }).lean();
  if (!agent) return res.status(404).json({ error: "Agent not found." });
  res.json({ agent });
});

router.post("/:slug/rate", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in to rate an agent." });
  const { stars, comment } = req.body || {};
  const starsNum = Number(stars);
  if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
    return res.status(400).json({ error: "stars must be an integer from 1 to 5." });
  }

  const agent = await Agent.findOne({ slug: req.params.slug });
  if (!agent) return res.status(404).json({ error: "Agent not found." });

  await Rating.findOneAndUpdate(
    { agentId: agent._id, userId: req.user._id },
    { $set: { stars: starsNum, comment: comment || "" } },
    { upsert: true }
  );

  const { score, passRate, avgRating } = await computeScore(agent._id);
  agent.score = score;
  agent.stats.passRate = passRate;
  agent.stats.avgRating = avgRating;
  await agent.save();

  res.json({ score: agent.score, avgRating: agent.stats.avgRating });
});

router.post("/:slug/check", async (req, res) => {
  const agent = await Agent.findOne({ slug: req.params.slug });
  if (!agent) return res.status(404).json({ error: "Agent not found." });
  if (!canManage(agent, req.user)) return res.status(403).json({ error: "Only the agent's owner or an admin can re-run checks." });

  try {
    const { agent: updated, check } = await runCheckForAgent(req.params.slug);
    res.json({
      score: updated.score,
      stats: updated.stats,
      results: check.results,
      safetyFlags: check.safetyFlags,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/:slug/run", async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  // Visitor (signed-out) limiting is session-cookie based since there's no User doc.
  if (!req.user) {
    if (req.session.visitorRunsDate !== today) {
      req.session.visitorRuns = 0;
      req.session.visitorRunsDate = today;
    }
    if ((req.session.visitorRuns || 0) >= VISITOR_DAILY_LIMIT) {
      return res.status(429).json({ error: `Sign in to keep going — visitors get ${VISITOR_DAILY_LIMIT} free runs a day.` });
    }
    // Increment and let cookie-session attach the updated Set-Cookie header
    // now, before headers are flushed below — once the SSE stream starts,
    // it's too late to add Set-Cookie to the response.
    req.session.visitorRuns = (req.session.visitorRuns || 0) + 1;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { run, agent } = await runAgent({
      slug: req.params.slug,
      inputs: req.body?.inputs || {},
      user: req.user,
      onChunk: (chunk) => send("chunk", { text: chunk }),
    });

    if (agent.stats.runs % RECOMPUTE_EVERY_N_RUNS === 0) {
      const { score, passRate, avgRating } = await computeScore(agent._id);
      agent.score = score;
      agent.stats.passRate = passRate;
      agent.stats.avgRating = avgRating;
      await agent.save();
    }

    send("done", { runId: run._id, shareId: run.shareId, status: run.status });
    res.end();
  } catch (err) {
    const status = err instanceof RunnerError ? err.status : 500;
    send("error", { message: err.message, status });
    res.end();
  }
});

export default router;
