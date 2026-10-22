# Agent One — A Forest of AI Agents

A free hub of student AI agents, shown as a forest. This is Milestone 1 of the
prototype: the data model, the generic agent runner, dev-mode auth, and a
forest → agent → sandbox → run → share flow for 3 seed agents.

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
runner and (in a later milestone) the check job both call the same adapter.

## Switching to real Google sign-in

Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL` in
`.env`. When these are present the server mounts `/api/auth/google` and
`/api/auth/google/callback` automatically; dev-mode login keeps working
alongside it.

## What's built in Milestone 1

- Mongo models: `User`, `Agent`, `Run`, `Rating`, `Check` (ratings/checks are
  defined now, used starting Milestone 2).
- Generic runner (`server/src/runner/run.js`): validates inputs, enforces
  daily run limits (20/signed-in, 3/visitor), builds the prompt, streams the
  LLM response over SSE, persists the run with a shareable link.
- LLM adapter (`server/src/llm/adapter.js`): `mock` | `gemini` | `groq`,
  selected by `LLM_PROVIDER`.
- Auth: dev-mode login (`POST /api/auth/dev-login`) always available; Google
  OAuth wired but optional.
- 3 seed agents across 3 groves: PYQ Solver (exams), Concept Explainer
  (study), DSA Hint Mentor (code) — `server/seed/agents/*.json`.
- Client: forest home page with live search, agent sandbox page with
  streamed output, public shared-run page, dev login page.

Not yet built (later milestones): the remaining 21 agents, the check job and
credibility scoring, uploads, ratings, the leaderboard, and the full 390px
responsive pass.
