# Agent वन (Agent One) — the tested agent directory

Agent One is an AI agent directory where every score comes from a real,
recorded test run — not a star rating or a human glancing at a landing page.
This replaces an earlier v1 prototype (a hub of prompt-template "agents");
v2 is a full rewrite to a different product, stack and data model. See
[`docs/v2 · Real-agent HLD.pdf`](docs/v2%20%C2%B7%20Real-agent%20HLD.pdf)
for the full spec. **This is Phase 1: Directory
core** — listings, the seed catalogue, directory browsing (including the 3D
forest), freshness checks, owner claims, and the admin console. Phase 2 (the
real eval harness — BullMQ, sandboxed runners, grading, scoring) is
scaffolded at the infra level but not built yet, since Phase 1 doesn't score
anything.

## Quickstart (under 10 minutes)

1. **Start MongoDB and Redis** (local containers, no account needed):
   ```bash
   docker compose up -d mongo redis
   ```
2. **Configure env vars**:
   ```bash
   cp .env.example .env
   ```
   Defaults work out of the box — `LLM_PROVIDER=mock` needs no API key, and
   auth falls back to dev-mode login when `GITHUB_CLIENT_ID`/`GOOGLE_CLIENT_ID`
   are blank.
3. **Install everything** (npm workspaces — one install covers api, worker,
   client and shared):
   ```bash
   npm install
   ```
4. **Seed the catalogue**:
   ```bash
   cd api && npm run seed
   ```
5. **Run it** — three processes, each in its own terminal:
   ```bash
   cd api && npm run dev       # http://localhost:4000
   cd worker && npm run dev    # connects to Redis, idle until Phase 2
   cd client && npm run dev    # http://localhost:5173
   ```
   Or `docker compose up` from the repo root to run all five services
   (mongo, redis, api, worker, client) in containers at once.
6. Open http://localhost:5173 — the forest should show 25 real listings
   across 5 categories immediately, no sign-in or API key required.

## The seed catalogue — real facts, not fabricated

`api/seed/listings.csv` has **25 real third-party listings** (5 per
category: code, research, data, browser, support), each independently
verified by visiting the agent's own site or repo — never copied from
another directory, per the HLD's core rule. Every listing starts at tier
**L0** (basic facts only); nothing is scored because nothing has been
benchmarked yet — that's Phase 2.

## Owner claims — real DNS/meta-tag verification

Claiming a listing (`POST /api/claims`) actually performs a live DNS TXT
lookup or page fetch (`api/src/services/claimVerification.js`) against the
listing's real source domain — not a simulated check. This has a known
limitation worth flagging: open-source listings hosted only on a shared
domain like `github.com` can't complete domain verification against that
domain (nobody can prove ownership of `github.com` itself) — the HLD's own
model handles open-source agents differently, through L3 sandboxing from
the repo, which is Phase 4 work.

A verified domain puts a claim in the **admin queue** (`/admin`) for an L1
smoke-test review before ownership and tier L1 are actually granted — domain
proof alone isn't enough per the HLD's two-step trust model.

## Switching to a real LLM

Set in `.env`:
```
LLM_PROVIDER=gemini   # or groq
LLM_API_KEY=your-key-here
LLM_MODEL=gemini-2.0-flash
```
Not used by anything in Phase 1 — this is here now because Phase 2's eval
harness (the LLM judge) and the flagship agents (Repo Fixer, Cited
Researcher) will call the same adapter (`api/src/llm/adapter.js`) without
any code changes once that phase is built.

## Switching to real GitHub/Google sign-in

Set `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` and/or
`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env`. The server mounts the
corresponding OAuth routes automatically; dev-mode login keeps working
alongside it. Dev-mode login never offers the "owner" role — ownership is
only ever granted through an approved claim (see above).

## Known gaps in `npm audit`

`tailwindcss`, `vite` and `react-router-dom` currently carry moderate/high
advisories that only matter for a publicly-exposed dev server or SSR (none
of which apply to local dev here) and would need major-version bumps to
clear — deferred rather than risking an unverified breaking change this
early. Revisit with `npm audit fix --force` before any public deployment.

## What's built in Phase 1

- Data model: `Listing`, `Manifest` (+ `agentone.yaml` parser/validator),
  `Claim`, `Dispute`, `Review`, `ScoreSnapshot`, `User` — `api/src/models/`.
- Directory API: search, category/tier/type/pricing/interface filters, "new"
  and "recently verified" sections, a listing page, a 2-3 way compare page —
  `api/src/routes/listings.js`.
- Freshness checks: `api/scripts/freshnessCheck.js` (cron-ready) and an
  admin "re-check now" button, both hitting real URLs.
- Owner claims with live DNS TXT / meta-tag verification, gated through an
  admin smoke-test queue before ownership/tier are granted.
- Admin console: claim queue, hide/unhide/merge listings, dispute list.
- Design system: the Agent वन wordmark, full dark/green/violet token set,
  liquid glass (CSS backdrop-filter + SVG `feTurbulence`/`feDisplacementMap`
  refraction on the nav pill and hero search bar), aurora hero.
- 3D forest (React Three Fiber, instanced tier-colored nodes, hover/click,
  slow camera drift) with an automatic 2D SVG fallback for phones/low-power
  devices/`prefers-reduced-motion` — both verified working in-browser.
- Verified at 390px width with no horizontal overflow.

Not yet built (Phase 2+): the eval harness itself (manifest-driven runners,
SSRF-safe fetch, deterministic + LLM-judge grading, the 3-run/5-part
scoring pipeline), task suites, the L3 Docker sandbox, the five flagship
agents, share loops (badges, run pages, head-to-head), the MCP server /
Agent Finder, and the monetization hooks. `OwnerDashboard` and the public
`Disputes` page also don't exist as pages yet (the API routes they'd use
already do).
