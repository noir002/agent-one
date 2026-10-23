# Agent वन (Agent One) — the tested agent directory

Agent One is an AI agent directory where every score comes from a real,
recorded test run — not a star rating or a human glancing at a landing page.
This replaces an earlier v1 prototype (a hub of prompt-template "agents");
v2 is a full rewrite to a different product, stack and data model. See
[`docs/v2 · Real-agent HLD.pdf`](docs/v2%20%C2%B7%20Real-agent%20HLD.pdf)
for the full spec. **Through Phase 3: task suites** — 24 real tasks (12 per
category) with a public/hidden split, safety tasks, and paraphrase rotation
to catch agents gaming the exact wording — on top of Phase 2's eval harness
(BullMQ orchestration, SSRF-safe runners, deterministic + LLM-judge grading,
the 3-run/5-part scoring pipeline) and Phase 1's directory core (listings,
the seed catalogue, directory browsing including the 3D forest, freshness
checks, owner claims, admin console).

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
4. **Seed the catalogue and the test tasks**:
   ```bash
   cd api && npm run seed && npm run seed:tasks
   ```
5. **Run it** — three processes, each in its own terminal:
   ```bash
   cd api && npm run dev       # http://localhost:4000
   cd worker && npm run dev    # the real eval-run processor as of Phase 2
   cd client && npm run dev    # http://localhost:5173
   ```
   Or `docker compose up` from the repo root to run all five services
   (mongo, redis, api, worker, client) in containers at once.
6. Open http://localhost:5173 — the forest should show 25 real listings
   across 5 categories immediately, no sign-in or API key required.

## Running an evaluation (Phase 2)

None of the 25 real seed listings have a connected endpoint yet — Phase 1
never completed a claim, and Phase 2's job is the harness, not outreach to
real owners. To see the harness run for real, point a manifest at the
**dev-only test fixtures** instead of a real listing:

```bash
# in two more terminals, from /api
npm run fixture:echo-agent   # implements the Task API contract, port 4100
npm run fixture:echo-mcp     # same thing over MCP, port 4101
```

Then, signed in as an admin (dev-login), connect one of the fixtures as a
listing's manifest — this is also exactly how a real owner connects theirs:

```bash
curl -X POST http://localhost:4000/api/listings/aider/manifest \
  -H "Content-Type: application/json" \
  --data '{"yaml": "name: aider\nversion: \"1.0.0\"\ncategory: code\nsummary: test\nowner:\n  name: Test\n  contact: test@example.com\n  verify: dns\ninterface:\n  type: http\n  endpoint: http://localhost:4100/run\npermissions:\n  network: none\n  max_steps: 10\n  max_cost_usd: 0.5\n  timeout_s: 60\npricing: { model: free }\n"}'
```

Submitting a manifest with a new version auto-queues an `EvalRun`; so does
`POST /api/listings/:slug/evaluate`. Watch the worker's logs for
`eval run ... done — score N`, then `GET /api/listings/aider` to see the
tier promoted to L2 and `score`/`scoreParts` populated. As of Phase 3, this
runs exactly the 9 hidden tasks for that category (6 regular + 3 safety) ×
3 runs each — the 3 public samples are never scored, only shown via
`GET /api/tasks`.

**Local-dev-only note**: the harness's SSRF protection blocks loopback
addresses by default (same as private ranges and cloud metadata) — the
fixtures above only work with `ALLOW_LOOPBACK_ENDPOINTS=true` in `.env`.
Private ranges and the metadata address stay blocked either way; see the
comment above that var in `.env.example` before ever considering it outside
local dev.

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
The harness's LLM judge (`api/src/harness/grading/judge.js`) calls this
adapter — with `LLM_PROVIDER=mock` it explicitly skips grading rather than
pretending to judge anything (`verdict: "SKIPPED"`), so a mock-mode eval run
is graded on deterministic checks only. The flagship agents (Phase 4) will
use the same adapter without any code changes.

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

## What's built in Phase 2

- Data model: `Task`, `EvalRun`, `TaskRun` — `api/src/models/`.
- `api/src/harness/safeFetch.js` — SSRF-safe fetch: resolves + validates the
  target IP against private/loopback/link-local/metadata/multicast ranges,
  **pins the connection to that exact IP** (defeats DNS-rebinding TOCTOU),
  and re-validates on every redirect hop. Verified by direct test: blocks
  `169.254.169.254`, `10.0.0.5` and `192.168.1.1` unconditionally.
- Runners: `httpRunner.js` (SSE Task API consumption, step-budget
  enforcement) and `mcpRunner.js` (`@modelcontextprotocol/sdk` client) — both
  verified end to end against local test fixtures, both runs and both grading
  paths (pass and fail) confirmed correct.
- Grading: deterministic checks (`grading/deterministic.js`) plus an LLM
  judge (`grading/judge.js`) that fences agent output as untrusted data, the
  same pattern v1 used for its safety-review check — a prompt injection in
  agent output can't talk the judge into a pass.
- Scoring (`scoring.js`): the exact 5-part formula, verified by hand against
  real results (0.5 success × 50% + 1.0 × (15%+15%+10%) + ~1.0 × 10% = 75,
  matching the logged score precisely).
- BullMQ wiring: `api/src/queue/evalQueue.js` (producer) and
  `worker/src/processors/evalRun.js` (the real processor, replacing Phase 1's
  stub) — confirmed working through the actual queue, not just in isolation.
- Manifest connection (`POST /api/listings/:slug/manifest`) and evaluation
  trigger (`POST /api/listings/:slug/evaluate`) routes — a version bump
  auto-queues an `EvalRun`, confirmed working twice in testing.
- Two dev-only test fixtures (`api/dev-fixtures/`) implementing the Task API
  contract over HTTP and MCP, since none of the 25 real listings have a
  connected endpoint yet.

**Three real bugs found and fixed during this phase's own testing** (not
hypothetical — each one broke a real run until fixed):
1. `dotenv/config` resolves `.env` relative to `process.cwd()`, so
   `cd api && npm run dev` was silently loading nothing — every service now
   uses `shared/loadEnv.js`, which resolves the repo-root `.env` regardless
   of invocation style.
2. Node's "Happy Eyeballs" dual-stack connect (default since Node 20) calls
   a custom `lookup` function expecting a different callback shape when
   racing multiple addresses — `safeFetch` now disables `autoSelectFamily`
   and handles both callback shapes, since the connection is already pinned
   to one pre-validated IP regardless.
3. The MCP test fixture crashed on anything past the first task run: a
   single shared transport across the harness's 6 sequential task runs
   conflated every client's session into one, corrupting the others. Fixed
   with the SDK's documented per-session-transport pattern.

## What's built in Phase 3

- **24 real tasks** (`api/seed/tasks.json`, 12 per category): 3 public
  samples, 6 hidden tasks each with a genuinely different-wording paraphrase,
  3 safety tasks (prompt injection, data leak, unsafe request) — the HLD's
  full 15+15+6 catalogue is a much larger content-authoring effort,
  deliberately scoped down the same way the 25-listing catalogue was.
- **A real scoring-rule fix, not just new content**: Phase 2's harness
  scored every task it found, with no public/hidden distinction (all 4
  placeholder tasks happened to be public, so it never mattered). The HLD is
  explicit — *"score only on hidden tasks"* — so `executeEvalRun` now
  queries `isPublicSample: false` only. Verified: an eval run executes
  exactly 9 tasks per category (6 regular + 3 safety), not 12.
- Inline paraphrase support on `Task` (`paraphrase: {input, fixtures}`,
  `activeVariant`) and `api/src/harness/taskVariant.js`, which every runner
  reads task content through — confirmed returning the paraphrased wording
  when active, by direct test.
- `POST /api/admin/tasks/rotate`: picks a random third of the regular hidden
  tasks per category (safety tasks and public samples excluded) and flips
  their active variant — confirmed rotating exactly 2 of 6 per category, both
  via the API and the new Admin console "Task suites" panel.
- `GET /api/tasks`: public sample tasks only, for an owner to see the format
  without ever exposing hidden tasks or their answer-key checks.
- **The safety checks were verified rigorously, not just run once**: the
  http test fixture got two deliberately-bad canned responses (one that
  complies with an embedded prompt injection, one that leaks a planted fake
  secret) specifically so the safety checks had something real to catch —
  confirmed both `output_not_contains` checks correctly failed those runs
  (not just trivially passing on a generic non-answer), and the resulting
  score dropped accordingly (66.7 → 45.6) when safety started failing.

**One more real bug found and fixed**: `runDeterministicChecks` required
`results.length > 0` to ever pass, which meant any judge-only task (like
the "refuse an unsafe request" safety tasks, which intentionally have zero
mechanical checks) auto-failed regardless of the judge's verdict. Fixed so a
task with no deterministic checks trivially passes that stage and leaves
grading entirely to the judge, as intended. A second fix:
`findOneAndUpdate` with `$set` on re-seeding silently left old documents
(the 4 tasks reused by title from Phase 2) missing the new `activeVariant`/
`paraphrase` fields entirely, since `$set` only touches fields present in
the payload — `seedTasks.js` now uses `findOneAndReplace` so re-seeding
always produces the full current schema shape.

Not yet built (Phase 4+): the L3 Docker sandbox and execution-based code
grading (Phase 3's code tasks have realistic fixtures — real file contents,
a described failing test — but are graded the same way every task is,
pattern checks + judge, not by actually running the fix against the test;
doing that safely needs the same sandboxing care as Phase 4 itself), the
five flagship agents, share loops, the MCP server / Agent Finder, and
monetization. `OwnerDashboard` and the public `Disputes` page still don't
exist as pages (the API routes do) — triggering an evaluation is
`curl`/admin-only, no UI button yet.
