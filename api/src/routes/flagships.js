import { Router } from "express";
import { handleRepoFixerRun } from "../flagships/repoFixer.js";
import { handleCitedResearcherRun } from "../flagships/citedResearcher.js";

const router = Router();
const VISITOR_DAILY_TRY_LIMIT = 5;

const HANDLERS = {
  "repo-fixer": handleRepoFixerRun,
  "cited-researcher": handleCitedResearcherRun,
};

// Real Task API endpoints — this is what the harness's httpRunner calls
// during an actual eval run, exactly like any outside agent's endpoint.
// No visitor cap here: the harness itself enforces run limits and budgets.
router.post("/repo-fixer/run", handleRepoFixerRun);
router.post("/cited-researcher/run", handleCitedResearcherRun);

// The public, lower-friction "Try it" path for a visitor on the listing
// page — capped per visitor per day (session-based, same pattern as v1's
// run limits), and supports an optional bring-your-own-key for that one
// request only. The key is never written to the session, the DB, or any
// log — it only ever lives in this request's req.llmOverride.
router.post("/:slug/try", async (req, res) => {
  const handler = HANDLERS[req.params.slug];
  if (!handler) return res.status(404).json({ error: "Unknown flagship." });

  const today = new Date().toISOString().slice(0, 10);
  if (req.session.flagshipTryDate !== today) {
    req.session.flagshipTryCount = 0;
    req.session.flagshipTryDate = today;
  }
  if ((req.session.flagshipTryCount || 0) >= VISITOR_DAILY_TRY_LIMIT) {
    return res.status(429).json({ error: `You've used all ${VISITOR_DAILY_TRY_LIMIT} free tries today — come back tomorrow.` });
  }
  req.session.flagshipTryCount = (req.session.flagshipTryCount || 0) + 1;

  const { provider, apiKey } = req.body?.byok || {};
  if (provider && apiKey) req.llmOverride = { provider, apiKey };

  return handler(req, res);
});

export default router;
