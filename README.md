# Agent One — A Forest of AI Agents

A free hub of student AI agents, shown as a forest. Through Milestone 3: the
upload flow (with pre-publish checks), recent-runs panel, and a full 390px
responsive pass — on top of Milestone 2's full 24-agent native catalogue, 10
unofficial "inspired by" prototypes of popular third-party AI tools, the
check job + credibility scoring, ratings, and the leaderboard, and
Milestone 1's generic runner, dev-mode auth, and forest → agent → sandbox →
run → share flow.

## Quickstart (under 10 minutes)

1. **Start MongoDB** (local container, no account needed):
   ```bash
   docker compose up -d
   ```
2. **Configure env vars**:
   ```bash
   cp .env.example .env
   ```
   Defaults work out of the box — `LLM_PROVIDER=mock` needs no API key, and
   auth falls back to dev-mode login when `GOOGLE_CLIENT_ID` is blank.
3. **Install and seed the server**:
   ```bash
   cd server
   npm install
   npm run seed
   npm run dev
   ```
   Server runs at http://localhost:4000.
4. **Install and run the client** (in a new terminal):
   ```bash
   cd client
   npm install
   npm run dev
   ```
   Client runs at http://localhost:5173 and proxies `/api` to the server.
5. Open http://localhost:5173, sign in with any name (dev-mode login), open
   an agent, and press Run — output streams in with a `[MOCK]` prefix.

## Switching to a real LLM

Set in `.env`:
```
LLM_PROVIDER=gemini   # or groq
LLM_API_KEY=your-key-here
LLM_MODEL=gemini-2.0-flash   # or e.g. llama-3.1-8b-instant for groq
```
Confirm the provider's current free-tier rate limits before relying on this
for a live demo — they change over time. No code changes are needed; the
runner and the check job both call the same adapter
(`server/src/llm/adapter.js`).

## Switching to real Google sign-in

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in
`.env`. When these are present the server mounts `/api/auth/google` and
`/api/auth/google/callback` automatically; dev-mode login keeps working
alongside it.

## The agent catalogue

- **24 native agents** across all 6 groves (study, exams, code, career,
  research, productivity) — `server/seed/agents/*.json`.
- **10 third-party-inspired prototypes** — `server/seed/external/*.json`.
  Each is an *unofficial* demo of a popular AI tool (ChatGPT, Google Gemini,
  GitHub Copilot, Perplexity, Notion AI, Grammarly, Replit AI, Character.AI,
  Jasper AI, QuillBot): the agent page shows a disclaimer ("inspired by —
  not affiliated with or endorsed by...") and a link to the real platform,
  and the sandbox run goes through our own generic runner/LLM adapter, not
  the real service. This avoids implying affiliation we don't have while
  still giving a working, interactive demo.

## Credibility scoring

`server/src/scoring/score.js` implements the brief's formula exactly:
`Score = 40·P + 30·((R-1)/4)·C + 20·S + 10·F`. It's recomputed after every
rating and every 10 runs (`server/src/routes/agents.js`). Run
```bash
npm run check:all
```
from `/server` to run every agent's test cases through the LLM adapter, do a
safety review, and print a pass-rate table — this is what the brief's kickoff
prompt asks for "at the end." **In mock mode the pass rate is not
representative** (the mock adapter returns generic templated text, so most
`mustInclude` checks fail by design) — set a real `LLM_PROVIDER`/`LLM_API_KEY`
for a meaningful run.

## Uploading your own agent

`/upload` (signed in required) — config only, as the brief requires: a name,
grove, tagline, system prompt, any number of input fields, and 2+ test
cases, built entirely in the browser (no code, no file upload). Submitting
runs the same check job used for the seeded catalogue
(`POST /api/agents` → `runCheckForAgent`); the agent publishes as a
**Seedling** only if every test case passes and the safety review raised no
flags, otherwise it's saved but kept unlisted (`status: "hidden"`) and the
page shows exactly which test cases failed. Resubmitting under the same name
updates that agent in place and re-runs the checks — the fix-and-resubmit
loop the brief describes. A name already used by someone else (or by seeded
catalogue data) is rejected rather than overwritten.

## What's built through Milestone 3

- Everything from Milestones 1–2 (generic runner, LLM adapter, dev/Google
  auth, run limits, shared run pages, full catalogue, scoring, leaderboard).
- Upload flow with pre-publish checks (see above).
- Recent public runs panel and test-case-results panel on the agent page.
- Scroll-to-top on route change.
- Verified at 390px width: home, grove, leaderboard, agent, shared-run,
  login, and upload pages all render without horizontal overflow.

Not yet built: admin verified-review flow and a "bring your own API key"
settings page for heavy users (both mentioned as stretch items in the brief,
not in any numbered milestone).
