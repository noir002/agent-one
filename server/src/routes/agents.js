import { Router } from "express";
import Agent from "../models/Agent.js";
import { runAgent, RunnerError } from "../runner/run.js";

const router = Router();
const VISITOR_DAILY_LIMIT = 3;

router.get("/", async (req, res) => {
  const { grove, q, sort } = req.query;
  const filter = { status: { $ne: "hidden" } };
  if (grove) filter.grove = grove;
  if (q) filter.name = { $regex: String(q), $options: "i" };

  let query = Agent.find(filter).select("slug name grove tagline score status stats");
  if (sort === "score") query = query.sort({ score: -1 });
  res.json({ agents: await query.lean() });
});

router.get("/:slug", async (req, res) => {
  const agent = await Agent.findOne({ slug: req.params.slug, status: { $ne: "hidden" } }).lean();
  if (!agent) return res.status(404).json({ error: "Agent not found." });
  res.json({ agent });
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
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const { run } = await runAgent({
      slug: req.params.slug,
      inputs: req.body?.inputs || {},
      user: req.user,
      onChunk: (chunk) => send("chunk", { text: chunk }),
    });

    if (!req.user) {
      req.session.visitorRuns = (req.session.visitorRuns || 0) + 1;
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
