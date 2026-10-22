import { Router } from "express";
import Agent from "../models/Agent.js";
import Rating from "../models/Rating.js";
import Run from "../models/Run.js";
import Check from "../models/Check.js";
import { runAgent, RunnerError } from "../runner/run.js";
import { computeScore, badgeFor } from "../scoring/score.js";
import { runCheckForAgent } from "../checks/runCheck.js";
import { slugify } from "../utils/slugify.js";

const router = Router();
const VISITOR_DAILY_LIMIT = 3;
const RECOMPUTE_EVERY_N_RUNS = 10;
const VALID_GROVES = ["study", "exams", "code", "career", "research", "productivity"];

function canManage(agent, user) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!agent.authorId) return true; // seeded/prototype agents have no owner yet
  return agent.authorId.equals(user._id);
}

// Stricter than canManage: a missing authorId means seed/prototype data,
// which an upload must never be able to silently take over.
function ownsForUpload(agent, user) {
  return Boolean(agent.authorId) && agent.authorId.equals(user._id);
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
  const latestCheck = await Check.findOne({ agentId: agent._id }).sort({ ranAt: -1 }).select("results safetyFlags ranAt").lean();
  res.json({ agent, latestCheck: latestCheck || null });
});

router.get("/:slug/runs", async (req, res) => {
  const agent = await Agent.findOne({ slug: req.params.slug }).select("_id").lean();
  if (!agent) return res.status(404).json({ error: "Agent not found." });
  const runs = await Run.find({ agentId: agent._id, status: "ok" })
    .sort({ createdAt: -1 })
    .limit(5)
    .select("shareId inputs output createdAt")
    .lean();
  res.json({
    runs: runs.map((r) => ({
      shareId: r.shareId,
      createdAt: r.createdAt,
      excerpt: r.output.slice(0, 140).replace(/\s+/g, " ").trim(),
    })),
  });
});

// Agents are config only — never runnable code. A submission here is JSON
// describing inputs/prompt/test cases; it never gets executed as code, only
// interpreted by the same generic runner every other agent goes through.
router.post("/", async (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Sign in to upload an agent." });

  const { name, grove, tagline, inputs, systemPrompt, outputFormat, testCases } = req.body || {};

  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "Name is required." });
  }
  if (!VALID_GROVES.includes(grove)) {
    return res.status(400).json({ error: `Grove must be one of: ${VALID_GROVES.join(", ")}` });
  }
  if (!systemPrompt || typeof systemPrompt !== "string" || !systemPrompt.trim()) {
    return res.status(400).json({ error: "System prompt is required." });
  }
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return res.status(400).json({ error: "At least one input field is required." });
  }
  for (const field of inputs) {
    if (!field.key || !field.label) {
      return res.status(400).json({ error: "Each input field needs a key and a label." });
    }
  }
  if (!Array.isArray(testCases) || testCases.length < 2) {
    return res.status(400).json({ error: "At least 2 test cases are required." });
  }
  for (const testCase of testCases) {
    if (!testCase.inputs || typeof testCase.inputs !== "object") {
      return res.status(400).json({ error: "Each test case needs an inputs object matching your input fields." });
    }
  }

  const slug = slugify(name);
  if (!slug) return res.status(400).json({ error: "Name must contain at least one letter or number." });

  let agent = await Agent.findOne({ slug });
  if (agent && !ownsForUpload(agent, req.user)) {
    return res.status(409).json({ error: "That name is already taken. Try a different name." });
  }

  const config = {
    name: name.trim(),
    grove,
    tagline: tagline || "",
    authorId: req.user._id,
    systemPrompt: systemPrompt.trim(),
    outputFormat: outputFormat || "markdown",
    model: "default",
    inputs,
    testCases,
    status: "hidden", // never published until checks pass, below
  };

  if (agent) {
    config.version = agent.version + 1;
    Object.assign(agent, config);
    await agent.save();
  } else {
    agent = await Agent.create({ slug, ...config });
  }

  const { agent: checkedAgent, check } = await runCheckForAgent(slug);
  const allPassed = check.results.length > 0 && check.results.every((r) => r.pass);
  const safe = check.safetyFlags.length === 0;

  checkedAgent.status = allPassed && safe ? "seedling" : "hidden";
  await checkedAgent.save();

  res.json({
    agent: { slug: checkedAgent.slug, status: checkedAgent.status, score: checkedAgent.score },
    published: checkedAgent.status === "seedling",
    results: check.results,
    safetyFlags: check.safetyFlags,
  });
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
