# Agent वन (Agent One) — the tested agent directory

Agent One is an AI agent directory where every score comes from a real,
recorded test run — not a star rating or a human glancing at a landing page.
This replaces an earlier v1 prototype (a hub of prompt-template "agents");
v2 is a full rewrite to a different product, stack and data model. See
[`docs/v2 · Real-agent HLD.pdf`](docs/v2%20%C2%B7%20Real-agent%20HLD.pdf)
for the full spec. **Through Phase 4: L3 sandbox and flagships** — a real
Docker sandbox runner (network-isolated, resource-limited, auto-cleaned up)
and two real flagship agents, Repo Fixer and Cited Researcher, hosted by
Agent One itself and gradable through the exact same harness as any outside
agent — on top of Phase 3's task suites (24 real tasks, public/hidden split,
safety tasks, paraphrase rotation), Phase 2's eval harness (BullMQ
orchestration, SSRF-safe runners, deterministic + LLM-judge grading, the
3-run/5-part scoring pipeline), and Phase 1's directory core (listings, the
seed catalogue, directory browsing including the 3D forest, freshness
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
4. **Seed the catalogue, test tasks, and flagships**:
   ```bash
   cd api && npm run seed && npm run seed:tasks && npm run seed:flagships
   ```
5. **Run it** — three processes, each in its own terminal:
   ```bash
   cd api && npm run dev       # http://localhost:4000
   cd worker && npm run dev    # the real eval-run processor as of Phase 2
   cd client && npm run dev    # http://localhost:5173
   ```
   Or `docker compose up` from the repo root to run all five services
   (mongo, redis, api, worker, client) in containers at once. Phase 4's L3
   sandbox and flagship code-exec tool additionally need a Docker daemon
   reachable from wherever the worker/api run — already true if you're
   running mongo/redis via `docker compose`.
6. Open http://localhost:5173 — the forest should show 27 real listings
   (25 third-party + 2 flagships) across 5 categories immediately, no
   sign-in or API key required. Open [Repo Fixer](http://localhost:5173/listing/repo-fixer)
   or [Cited Researcher](http://localhost:5173/listing/cited-researcher) and
   use "Try it" for a real (if mock-mode-limited) live run.

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

## What's built in Phase 4

- **L3 Docker sandbox** (`api/src/harness/codeSandbox.js` +
  `runners/dockerRunner.js`): `--network none`, hard memory/CPU/pids limits,
  a real wall-clock timeout that force-kills the container, guaranteed
  cleanup. **Directly verified, not assumed**: a network-reaching command
  inside the sandbox fails at DNS resolution (no interface to even query);
  a hung container is killed at exactly its timeout and leaves zero trace
  in `docker ps -a` afterward. Ran a full 27-run eval through it against a
  local test fixture — same event/output shape as http/mcp, gradable by the
  unmodified `deterministic.js`/`judge.js`.
- **Scope cut, same honesty as every phase**: onboarding any real
  open-source agent (Aider, SWE-agent, etc.) through the docker runner is
  deferred — each has its own bespoke CLI contract to translate, a per-agent
  integration effort on the scale of a task suite. The generic sandbox
  mechanism is proven against a fixture; breadth is the flagged next step.
- **Two real flagship agents**, `api/src/flagships/`, hosted on Agent One's
  own api service and graded through the *exact same* http runner as any
  outside agent (ran a full eval against Repo Fixer directly — no
  special-cased harness path):
  - **Repo Fixer**: checks a candidate fix's syntax for real inside the
    sandbox (the same primitive as the L3 runner), asks the LLM adapter for
    a fix, retries up to 5 times. In mock mode it honestly declines to
    overwrite working code with mock's generic text, rather than faking a
    "smart" result — verified directly via the raw SSE stream.
  - **Cited Researcher**: real tools today, no paid key needed — search via
    DuckDuckGo's free Instant Answer API, page fetch via `safeFetch`. Only
    ever cites a URL it actually fetched successfully. **Found and fixed a
    real bug while testing it**: Wikipedia returned 403 without an
    identifying `User-Agent` header — `safeFetch` now sends one by default.
  - Both get `isFlagship: true` listings; `GET /api/listings?sort=score`
    now excludes them — confirmed Repo Fixer still doesn't appear there
    even after a real eval run gave it a real score (51.1).
- **"Try it" UI** on both listing pages: a live SSE-streamed run box with a
  5-per-day visitor cap (confirmed blocking the 6th try) and an optional
  bring-your-own-key field for that one request only. Required extending
  `generate()` to accept a per-call provider/key override instead of
  mutating `process.env` — the global-mutation approach would race across
  concurrent visitors using different keys.

## What's built in Phase 5

Trust and owner tools — five features, all verified end-to-end against a
real owner/visitor flow (claimed a listing, connected a manifest to the
`echoAgent.js` fixture, ran a real `EvalRun` through it, then drove every
piece of UI in the browser), not just unit-level API calls.

- **Run-backed reviews, closing the real gap this phase targeted**: 25 of
  27 seed listings could never be reviewed before this — `Review.runId`
  required a `TaskRun`, which only a full owner/admin-triggered benchmark
  produces. New `QuickRun` model + `POST /listings/:slug/quick-run`
  generalizes the Phase 4 flagship "Try it" pattern to any `http`/`mcp`
  listing, dispatched through the *same* `getRunner()` the harness uses —
  no new runner code. Signed-in, capped at 10/day. **Found and fixed a real
  bug while building it**: the route initially passed `manifest.permissions`
  (owner-declared, snake_case `max_steps`/`timeout_s`) straight through as
  `task.budget` — but the runners read camelCase `maxSteps`/`timeoutS` (see
  `Task.js`), so the owner's declared budget was silently ignored in favor
  of hardcoded fallbacks. Fixed before it ever ran, by mapping the fields
  explicitly (`api/src/routes/reviews.js`).
- **Owner dashboard** (`/owner`): manifest connect/update, "request
  re-test," recent-run history with failed `TaskRun`s surfaced inline, and
  "file a dispute" right from a failed trace. Verified as a real non-admin
  owner (claimed via the existing DNS-claim flow, domain check bypassed
  only as a test-setup step since we don't control the seeded listing's
  real domain — the app code itself has no bypass).
- **Dispute filing**, now real end-to-end: `POST /api/disputes` (owner/admin
  only — confirmed a non-owner gets a 403), `dueAt` = filed + 7 days, admin
  console sorts overdue first, resolve action wired to a UI for the first
  time (the API existed since Phase 1, never had one). Confirmed resolved
  disputes appear on the public `GET /api/disputes` with their resolution
  text.
- **Score history + leaderboard**: every `EvalRun` has written a
  `ScoreSnapshot` since Phase 2; nothing read them back until now. Ran two
  evals against a test listing and confirmed the history returns both in
  order. `/leaderboard` reuses `GET /api/listings?sort=score` (already
  flagship-excluded since Phase 4) filtered to `score != null`; confirmed
  category filtering excludes a code-category listing when filtered to
  research.
- **Weekly spot-check script** (`api/scripts/spotCheck.js`, `npm run
  spotcheck`): samples ~10% of L2/L3 listings, re-queues an `EvalRun` for
  each, flags `Listing.scoreGapFlag` when the new score differs from the
  prior one by 20+ points. Ran it twice against a live listing: once with
  no prior score drift (correctly logged "ok," no flag) and once after
  seeding an artificially divergent prior score (correctly flagged a 44.4
  point gap) — then cleared the flag through the new admin endpoint.

**Scope cuts, same honesty as every phase:**
- QuickRun is `http`/`mcp` only — a `docker` quick-run would mean building
  an owner-submitted image on demand for any signed-in visitor's click,
  real cost and abuse surface this phase doesn't take on.
- "Admin review within 7 days" is a process commitment `dueAt` tracks, not
  something code enforces — there's no automatic escalation or lockout.
- `scoreGapFlag` lives on the `Listing` itself and surfaces in the existing
  admin console, rather than a dedicated review-queue UI — same shape as
  the admin tooling added in Phases 1-3.

Not yet built (Phase 6+): onboarding real open-source agents through the
docker runner (see above), the MCP server / Agent Finder, and monetization.

## What's built in Phase 6

Share loops — public run pages, live SVG badges, head-to-head pages, Open
Graph images, and a monthly benchmark report, per the HLD's exact Phase 6
spec. Verified end-to-end: claimed two code-category listings, benchmarked
both against the echo fixture, and drove every new page through the
browser, not just the API.

- **Public run pages** (`/runs/task/:id`, `/runs/quick/:id`) — a
  step-by-step timeline (reusing the same `events[]` shape `TaskRun` has
  had since Phase 2), the real output, deterministic check results (now
  showing each check's pass/fail reason, not just an overall verdict), and
  the judge verdict. **Resolved design call, not a loose end**: these show
  the real hidden-task content — the anti-gaming defenses are paraphrase
  and monthly task rotation surviving *partial* exposure, not secrecy of
  wording forever, and a run page is only proof if it's the real thing.
  `QuickRun` didn't store a trace before this phase (just final
  input/output) — extended it with `events`/`tokens`/`costUsd`/`latencyMs`
  (the runner already returns all of this; the route just wasn't saving
  it) so its run page has a real timeline too, confirmed end-to-end with a
  live quick-run.
- **Live SVG badge** (`GET /api/listings/:slug/badge.svg`) — honest about
  what's known: `L0`/`L1` show "Agent One · Listed", never a fabricated
  score. **Found and fixed a real bug while testing it**: the badge
  originally used `Listing.lastVerifiedAt` for "tested Nd ago" — that's
  the daily *site-liveness* check, a different thing entirely, so a
  same-day-benchmarked listing showed "not yet tested." Fixed to use the
  latest `ScoreSnapshot.computedAt` instead, confirmed by re-fetching the
  badge right after a real eval run and seeing "tested today." Listing
  page now has a "Badge" section with live preview and copyable
  Markdown/HTML embed snippets.
- **Head-to-head pages** (`/head-to-head/:slugA/:slugB`) — a per-task
  pass-rate table between two same-category listings, computed from each
  one's most recent `EvalRun` (no new eval work; confirmed the table
  matches the real `TaskRun` data for two listings benchmarked against the
  same fixture). Cross-category pairs are rejected. `Compare.jsx` (2-3
  agent metadata compare, Phase 1) gets a "View task-by-task breakdown"
  link when exactly 2 selected listings share a category and both score.
- **Open Graph images** — one shared SVG-card template
  (`api/src/og/renderCard.js`) rasterized to PNG via `sharp` (new
  dependency; prebuilt binaries, confirmed working on first try), reused
  for run pages, head-to-head pages and the monthly report. All three
  variants visually confirmed as real 1200×630 branded PNGs, not just
  200-status checks.
- **A real architectural problem, solved, not hand-waved**: the client is
  a pure client-rendered SPA (`client/index.html` has one static
  title/description, no SSR) — link-unfurling bots (X, LinkedIn, Discord)
  read `<meta property="og:*">` from the raw HTML *without running JS*, so
  a React-rendered page's tags are invisible to them. Built a small,
  separate server-rendered stub per shareable resource
  (`api/src/routes/share.js`, `GET /api/share/...`): a bot reads its
  static OG tags, a human gets an instant `<meta refresh>` redirect to the
  real SPA page. **Scope cut, stated plainly**: wiring a production proxy
  to route bots vs. humans to this stub on the *same* URL is deployment
  infra this project has never set up (dev runs client:5173 and api:4000
  separately) — verified by curling each stub directly and inspecting the
  tags/image, not a live social-platform unfurl test.
- **Monthly benchmark report** (`api/scripts/generateReport.js`, `npm run
  report:generate`, cron-ready) — snapshots the leaderboard per category
  plus "most improved" (vs. the closest `ScoreSnapshot` ≥30 days old) and
  "newly benchmarked" into a frozen `Report` document so a past month
  stays stable as scores keep moving. Confirmed idempotent (re-running for
  the same month overwrites in place) and confirmed it reflects real
  listing data once two listings were actually benchmarked.

**Scope cuts, same honesty as every phase:**
- Flagship "Try it" runs stay ephemeral (SSE, nothing persisted) —
  persisting anonymous visitor runs is a different concern from this
  phase's signed-in `QuickRun`s and benchmark `TaskRun`s.
- The production bot/human routing proxy for OG stubs (above) isn't built
  — this project has no production deployment story yet at all.

## What's built in Phase 7

Agent-readable directory and Agent Finder — per the HLD's exact spec: a
public read API with rate limits, an MCP server, Agent Finder as the third
flagship, and `llms.txt`/schema.org data. This phase's audience is AI
assistants, not human visitors, so most of it was verified with a real
protocol client rather than a browser.

- **Agent Finder** (third flagship, `api/src/flagships/agentFinder.js`) —
  the one piece of this phase a human sees: a "Try it" box on its listing
  page like the other two flagships. **Its selection logic never touches
  an LLM**, unlike Repo Fixer/Cited Researcher: `findAgentsForTask`
  (`api/src/finder/findAgentsForTask.js`) ranks only real, benchmarked
  (`score != null`) listings by `$text` relevance, falling back to
  top-score if nothing matches. An LLM call (skipped entirely in mock
  mode — confirmed via a live "Try it" run, no fabricated prose attached)
  only narrates an *already-fixed* list, which is what makes this
  provably compliant with "no payment, plan or sponsorship may change...
  Agent Finder result" (HLD) — not a promise, a property of the code path.
  Not benchmarked itself (no hidden-task suite fits "recommend an agent");
  category `support` is a bookkeeping field only, documented as such.
- **MCP server** (`api/src/mcp/server.js` + `api/src/routes/mcp.js`,
  mounted at `/api/mcp`) — `search_agents`, `get_agent_evidence`,
  `find_agent_for_task`, all three wrapping the exact same functions the
  REST API and Agent Finder use (the shared query builder extracted from
  `routes/listings.js` into `listings/queryBuilder.js`, plus
  `findAgentsForTask`/`getAgentEvidence`). Session-stateful streamable-HTTP
  transport with a per-session map — the server-side mirror of the
  client-side session-conflation fix from Phase 2's `mcpRunner.js`.
  **Verified as a real MCP round-trip, not an HTTP 200 check**:
  `api/scripts/verifyMcp.js` (`npm run mcp:verify`, kept as a permanent dev
  tool) connects with the SDK's own client and calls all three tools for
  real — confirmed `find_agent_for_task` returns nothing until a listing
  is actually benchmarked, then returns it with a working evidence link
  once it is.
- **Rate limiting** (`express-rate-limit`, new dependency, global on
  `/api` in `app.js`) — 300 requests/15min per IP. **Confirmed it actually
  blocks**: fired real requests past the threshold and got a genuine 429,
  not just inspected that the middleware was wired in.
- **`llms.txt`** (`GET /llms.txt`, outside `/api`, generated live from
  real top-scored listings on every request — never hand-maintained, so
  it can't drift).
- **schema.org** — extends the exact share-stub mechanism from Phase 6
  with `GET /api/share/listings/:slug` (`SoftwareApplication` JSON-LD):
  `aggregateRating` from real `Review` stars (Phase 5), a separate
  `additionalProperty` for the Agent One benchmark score (a different
  scale/meaning, not conflated with user ratings). Confirmed both fields
  populate correctly once a listing actually has a score and a review.
  Also injected client-side on `Listing.jsx` (defense-in-depth for
  JS-executing crawlers like Googlebot) via a small duplicated builder
  (`client/src/lib/jsonLd.js` — same api/client duplication tradeoff
  `format.js`'s `daysSince` already makes). A 4th OG card variant
  (`/api/og/listing/:slug.png`) was added for consistency even though the
  HLD only asked for structured data here, since it's a two-line reuse of
  Phase 6's existing card template.

**Scope cuts, same honesty as every phase:**
- The open CORS policy needed for the MCP endpoint (so assistants other
  than our own SPA's origin can call it) is scoped to exactly that one
  route, not widened app-wide — the rest of the API keeps its
  cookie-session-safe single-origin policy.
- No API-key/auth layer on the public API or MCP server — the HLD calls
  it a "public read API," meant to be callable by any assistant.

## What's built in Phase 8

Monetization hooks — the HLD's last build phase. Real data model fields,
real admin/owner actions, real gated behavior; payment itself stays
stubbed, exactly as the HLD frames it ("no live payments yet... I will
choose the gateway later"). The HLD's rule for this phase — *"no payment,
plan or sponsorship may change a score, tier, leaderboard position or
Agent Finder result"* — was verified directly, not just designed for:
granted Verification Pro and credits, ran a real benchmark both ways, and
confirmed the score/tier computation (`scoring.js`/`executeEvalRun`) never
branches on either.

- **Plans** (`User.plan`) — a free-plan owner gets one manual re-test per
  24h; Pro and admin bypass it. **Found and fixed a real bug while
  testing this**: the cooldown counted *any* user-triggered `EvalRun`,
  including the automatic one `POST /manifest` queues on a version bump —
  so simply reconnecting a manifest immediately burned a free owner's
  entire daily allowance before they'd ever clicked "Request re-test."
  Fixed by adding `EvalRun.triggerSource` (`manual`/`manifest_version`/
  `ci`/`spotcheck`) so the cooldown only ever counts actual manual
  requests. Pro also unlocks a CI hook (`POST /api/ci/evaluate`,
  bearer-token auth — confirmed it works with no session cookie and
  rejects a wrong/missing token) and a private-trace-detail toggle
  (confirmed `GET /api/runs/task/:id` redacts `events`/`finalOutput` for
  anonymous/other-user requests while the owner still sees everything).
- **Private eval runs behind credits** — spending a credit runs the
  *exact* same grading pipeline (same deterministic checks, same judge,
  same `TaskRun` storage) but `executeEvalRun` skips the
  `Listing.score`/`scoreParts`/`tier` write and the `ScoreSnapshot.create`
  call. Confirmed live: triggered a private run, watched the public score
  stay unchanged and the score-history length stay at 1. **Found and
  fixed four real leaks while verifying this**: `findAgentsForTask`,
  `getAgentEvidence`, the head-to-head route, and the OG-image/share-stub
  routes for a task run all picked the *most recent* `EvalRun` regardless
  of privacy — so a private run's pass/fail counts, "evidence" links, and
  even its share card could surface through Agent Finder, the MCP server,
  a head-to-head comparison, or a shared link, defeating the entire point
  of "private." Every one of those now excludes `isPrivate: true` runs,
  and the public run-page route 404s a private `TaskRun` to anyone but
  the owner/admin (confirmed for anonymous, owner, and admin requests).
- **Sponsored slots** — `isSponsored` has existed since Phase 1 with no
  way to set it; added an admin toggle and a "Sponsored" strip on the
  home page's category view. Confirmed directly, not just by code
  inspection, that toggling it changes nothing about `sort=score` order
  or `find_agent_for_task`'s recommendation (re-ran both before/after).
- **Clean payment interface** (`api/src/payments/provider.js`) — one
  `grantPlan`/`grantCredits` interface, one `MockPaymentProvider`
  implementation; the admin console's "Grant Verification Pro" and
  "Grant credits" actions are the only things that call it. A real
  gateway's webhook handler would call the same two methods instead of
  an admin route — the seam the HLD asked for.
- **"How we make money"** updated from all-"Planned" (Phase 1) to what's
  actually real now, and a stray "Fast-track claims" entry — a Phase 1
  guess, not an actual HLD Phase 8 line item — was dropped rather than
  marked done it never was.

**Scope cuts, same honesty as every phase:**
- Sponsored slots are admin-set only — no self-serve purchase flow, no
  expiry date; consistent with "no live payments yet."
- Credits and plan grants are admin-only "simulate" actions — there's no
  real checkout anywhere in the app.
- The CI token is single-token-per-listing with no scoping beyond
  "trigger a re-test," no rotation history.

This completes all 8 phases of the HLD's build order.
