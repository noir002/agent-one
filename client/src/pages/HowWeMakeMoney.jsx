const STREAMS = [
  {
    name: "Verification Pro",
    status: "Hooked up — no live payments",
    detail: "A paid plan for owner accounts: one manual re-test per 24h on Free (none on Pro), a private-trace-detail toggle, and a CI hook endpoint for triggering re-tests from a build pipeline. All three only gate access, frequency or visibility — never the score, tier or ScoreSnapshot, which executeEvalRun computes identically for every plan.",
  },
  {
    name: "Sponsored slots",
    status: "Hooked up — no live payments",
    detail: "Admin-set for now (no self-serve checkout). Shown in a clearly labelled \"Sponsored\" strip on category pages. Structurally excluded from the leaderboard sort, the public search filters and Agent Finder's ranking — none of that code reads isSponsored at all, so there's nothing for a sponsorship to influence.",
  },
  {
    name: "Private eval runs",
    status: "Hooked up — no live payments",
    detail: "Owners spend a credit to run the full suite with no score published — the same grading pipeline, same deterministic checks and judge, just not written to the public score/tier/ScoreSnapshot. Credits are admin-granted for now (no live payments yet).",
  },
  {
    name: "Payment gateway",
    status: "Not started",
    detail: "Every grant above (plans, credits) runs through one internal interface (api/src/payments/provider.js) with a single mock implementation — a clean seam for a real gateway later, not wired to one yet.",
  },
];

export default function HowWeMakeMoney() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold text-ink">How we make money</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        No real payments are wired up yet — plans and credits below are granted manually by an admin
        while there's no gateway. This page exists so the rule is public from day one, before there's
        any money to be tempted by:
      </p>
      <div className="glass mt-4 rounded-card p-5">
        <p className="text-sm font-medium text-emerald">No payment, plan or sponsorship may ever change a score, a tier, a leaderboard position, or an Agent Finder recommendation.</p>
      </div>

      <div className="mt-8 space-y-4">
        {STREAMS.map((s) => (
          <div key={s.name} className="glass rounded-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-ink">{s.name}</h2>
              <span className="glass-chip rounded-full px-2.5 py-0.5 text-xs text-ink-muted">{s.status}</span>
            </div>
            <p className="mt-2 text-xs text-ink-muted">{s.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
