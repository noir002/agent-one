import { Router } from "express";
import { handleRepoFixerRun } from "../flagships/repoFixer.js";
import { handleCitedResearcherRun } from "../flagships/citedResearcher.js";
import { handleAgentFinderRun } from "../flagships/agentFinder.js";

const router = Router();
const VISITOR_DAILY_TRY_LIMIT = 5;

const HANDLERS = {
  "repo-fixer": handleRepoFixerRun,
  "cited-researcher": handleCitedResearcherRun,
  "agent-finder": handleAgentFinderRun,
};

// Real Task API endpoints — this is what the harness's httpRunner calls
// during an actual eval run, exactly like any outside agent's endpoint.
// No visitor cap here: the harness itself enforces run limits and budgets.
router.post("/repo-fixer/run", handleRepoFixerRun);
router.post("/cited-researcher/run", handleCitedResearcherRun);
// Agent Finder is never run through the eval harness (no hidden-task suite
// fits "recommend 3 agents") but still exposes a real Task API endpoint for
// consistency with the other flagships and its own manifest.
router.post("/agent-finder/run", handleAgentFinderRun);

// The public, lower-friction "Try it" path for a visitor on the listing
// page, and supports an optional bring-your-own-key for that one request
// only. The key is never written to the session, the DB, or any log — it
// only ever lives in this request's req.llmOverride.
//
// The daily cap only applies when the run uses Agent One's own LLM config
// — that's the case costing Agent One real money. A visitor supplying
// their own key pays for (and is responsible for) their own usage, so
// there's nothing here for the cap to protect; it's skipped entirely.
router.post("/:slug/try", async (req, res) => {
  const handler = HANDLERS[req.params.slug];
  if (!handler) return res.status(404).json({ error: "Unknown flagship." });

  const { provider, apiKey } = req.body?.byok || {};
  const usingOwnKey = Boolean(provider && apiKey);

  if (usingOwnKey) {
    req.llmOverride = { provider, apiKey };
  } else {
    const today = new Date().toISOString().slice(0, 10);
    if (req.session.flagshipTryDate !== today) {
      req.session.flagshipTryCount = 0;
      req.session.flagshipTryDate = today;
    }
    if ((req.session.flagshipTryCount || 0) >= VISITOR_DAILY_TRY_LIMIT) {
      return res.status(429).json({ error: `You've used all ${VISITOR_DAILY_TRY_LIMIT} free tries today — come back tomorrow, or paste your own API key for unlimited tries.` });
    }
    req.session.flagshipTryCount = (req.session.flagshipTryCount || 0) + 1;
  }

  return handler(req, res);
});

export default router;
