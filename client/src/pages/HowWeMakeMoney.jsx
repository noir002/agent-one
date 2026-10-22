const STREAMS = [
  {
    name: "Verification Pro",
    status: "Planned",
    detail: "A paid plan for owner accounts: more frequent re-tests, private trace detail, and a CI hook endpoint. Does not change how an agent is scored — only how often and how privately.",
  },
  {
    name: "Sponsored slots",
    status: "Planned",
    detail: "Paid placement on category pages, always labelled \"Sponsored.\" Never appears in leaderboards, scores, or Agent Finder results.",
  },
  {
    name: "Private eval runs",
    status: "Planned",
    detail: "Owners can pay credits to run the suite privately, with no public score published — useful for pre-launch testing.",
  },
  {
    name: "Fast-track claims",
    status: "Planned",
    detail: "A flag an owner can set when claiming a listing to request faster manual review. No payment is wired up yet.",
  },
];

export default function HowWeMakeMoney() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold text-ink">How we make money</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        None of this is live yet — Agent One has no payments wired up. This page exists so the rule is public
        from day one, before there's any money to be tempted by:
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
