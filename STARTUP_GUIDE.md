# Agent One — Startup Guide

Everything here is verified against the actual files in this repo (`package.json`
scripts, `docker-compose.yml`, `.env.example`) and against real problems hit while
running this project in development — not guessed.

## Prerequisites

- Node.js 20+
- Docker (for MongoDB/Redis via `docker-compose`, **and** for the L3 sandbox —
  see "Docker" below, it's not optional if you want Repo Fixer or any real
  benchmark run to work)
- `npm` (this is an npm workspaces monorepo: `api`, `worker`, `client`, `shared`)

## 1. One-time setup

```bash
git clone <this repo>
cd AgentOne
npm install
cp .env.example .env
```

Then open `.env` and fill in what you need — see **"Where configuration
actually matters"** below for what's required vs. optional.

## 2. Start infrastructure (MongoDB + Redis)

```bash
docker-compose up -d mongo redis
```

Redis is required even in dev — the eval harness queues real benchmark runs
through BullMQ, and the worker won't process anything without it.

## 3. Seed data (run once, from `api/`)

```bash
cd api
npm run seed              # ~25 real third-party listings
npm run seed:tasks        # hidden task suites (code + research categories)
npm run seed:flagships    # Repo Fixer, Cited Researcher, Agent Finder
npm run seed:directory -- --batch=1   # community directory tools (batch 1+)
```

## 4. Start the three dev servers

**Each one runs from its own package directory — this is the single most
common way to break this project.** Running `worker`'s script from inside
`api/` (or vice versa) fails with `MODULE_NOT_FOUND`, not an obviously
worker-related error. Three separate terminals:

```bash
# Terminal 1 — API (port 4000)
cd api && npm run dev

# Terminal 2 — worker (processes queued eval runs — nothing benchmarks without this)
cd worker && npm run dev

# Terminal 3 — client (port 5173)
cd client && npm run dev
```

Or, from the repo root, using npm workspaces (equivalent, one line each):

```bash
npm run dev -w api
npm run dev -w worker
npm run dev -w client
```

Or run the whole stack (mongo, redis, api, worker, client) in Docker:

```bash
docker-compose up
```

**Verify it's actually up:**
```bash
curl http://localhost:4000/api/health   # {"ok":true}
curl http://localhost:5173              # 200
```

If the worker isn't running, eval runs will sit at `status: "queued"`
forever — a very common "nothing is happening" symptom that isn't an error
anywhere, just a missing process.

## Where configuration actually matters

| Variable | Required? | What breaks without it |
|---|---|---|
| `MONGODB_URI` | **Required** | Nothing starts — the API refuses to boot without a DB connection. |
| `REDIS_URL` | **Required** | The worker can't connect; every benchmark run queues forever and never runs. |
| `SESSION_SECRET` | **Required** (has a dev default) | Sessions still work with the `.env.example` default, but never use that default anywhere real — it's a visible placeholder. |
| **Docker running** | **Required for Repo Fixer / real benchmarks** | `checkSyntax` (Repo Fixer's own verification step) and the L3 sandbox runner both shell out to the `docker` CLI. If Docker isn't running, Repo Fixer's "Try it" fails immediately, and any `docker`-interface listing can't be benchmarked at all. |
| `LLM_PROVIDER` + `LLM_API_KEY` | **Optional, but limits what's real** | Defaults to `mock` — the judge and flagships still run, but Repo Fixer/Cited Researcher return canned mock text instead of a real fix/answer, and Agent Finder skips its LLM narration (its actual recommendation logic doesn't need a key at all). Set `LLM_PROVIDER=groq` or `gemini` + a real `LLM_API_KEY` for real output. Current defaults: Groq → `openai/gpt-oss-20b`, Gemini → `gemini-3.8-flash`. |
| `LLM_MODEL` | Optional | Overrides the provider's default model above. |
| `GITHUB_CLIENT_ID`/`SECRET`, `GOOGLE_CLIENT_ID`/`SECRET` | Optional | Leave blank and dev-mode login (`/login`, any name + role) works fine — this is how every test in this project has actually been run. The real sign-in buttons on the login page are **visible either way** right now (a known gap — they 404 if these aren't set), so don't click them unless you've filled these in. |
| `ALLOW_LOOPBACK_ENDPOINTS` | Dev-only, default `false` | The harness's SSRF protection blocks `localhost`/loopback endpoints by default (correct, real security behavior). Set this to `true` only to point a manifest at a local test fixture (`npm run fixture:echo-agent` in `api/`) — **never** in anything resembling production. |

## Useful one-off scripts (all run from `api/`, all CLI-only — no scheduler exists for any of these yet)

```bash
npm run freshness:check          # re-checks every listing's site/repo liveness
npm run spotcheck                # re-benchmarks a random 10% of L2/L3 listings
npm run report:generate          # generates this month's "State of Agents" report
npm run directory:check-security # runs the website-hygiene check on the community directory
npm run mcp:verify               # connects a real MCP client to confirm the MCP server works
```

## Dev fixtures (for testing the harness without a real third-party agent)

```bash
cd api
npm run fixture:echo-agent   # a Task-API-compliant HTTP agent on :4100
npm run fixture:echo-mcp     # an MCP server fixture
```

Point a manifest's `interface.endpoint` at `http://localhost:4100/run` (with
`ALLOW_LOOPBACK_ENDPOINTS=true`) to run a real end-to-end eval without needing
an actual external agent.

## Known pitfalls (hit for real this session, not hypothetical)

- **The client dev server (`vite`) can silently die** with nothing in the
  terminal pointing at it — if `/` or any page stops responding, check it's
  still running before assuming something else broke.
- **The worker's entry point is `worker/src/worker.js`, not
  `api/src/worker.js`** — there is no `worker.js` inside `api/` at all; `node --watch src/worker.js`
  only works from inside `worker/`.
- A manifest pointing at `localhost` will fail with `"localhost resolves to
  a blocked address"` unless `ALLOW_LOOPBACK_ENDPOINTS=true` **and** the
  worker was started (or restarted) after that env var was set — `node --watch`
  only reloads on `.js` file changes, not `.env` changes, so flipping that
  flag needs a manual worker restart to take effect.
