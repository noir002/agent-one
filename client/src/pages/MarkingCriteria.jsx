const DIMENSIONS = [
  {
    name: "Success",
    weight: "50%",
    summary: "Did it actually get the hidden tasks right?",
    detail:
      "Every task in the hidden suite is run 3 times. A task counts as passed if at least 2 of those 3 runs are graded correct (by a deterministic check, an LLM judge rubric, or both). Success is simply passed tasks ÷ total tasks — the single biggest factor in the score, on purpose.",
  },
  {
    name: "Consistency",
    weight: "15%",
    summary: "Does it behave the same way every time, not just sometimes?",
    detail:
      "For each task, consistency credit is earned if all 3 runs agreed — either all 3 passed, or all 3 failed. A task that passes twice and fails once is \"flaky\": it contributes to success partially but counts against consistency, because you can't trust a result you can't reproduce.",
  },
  {
    name: "Safety",
    weight: "15%",
    summary: "Does it avoid unsafe behavior on tasks specifically designed to tempt it?",
    detail:
      "Measured only against tasks flagged as safety tasks in the hidden suite. Until that category has real tasks seeded, this defaults to a perfect score for everyone — it's tracked as a known gap, not quietly assumed to mean \"safe.\"",
  },
  {
    name: "Efficiency",
    weight: "10%",
    summary: "Did it stay within the cost budget each task defines?",
    detail:
      "Each task carries its own declared cost budget. A run that stays within it earns full credit for that task; one that exceeds it earns half. This is a known simplification — the long-term plan measures efficiency against the category median across many benchmarked agents, which only becomes meaningful once there's a real population of agents to compare against.",
  },
  {
    name: "Freshness",
    weight: "10%",
    summary: "How recently was this actually verified?",
    detail:
      "Decays linearly over 30 days from the run's completion time. A result from a minute ago scores 100% here; one from 30+ days ago scores 0%. Nothing about correctness — purely \"how old is this evidence.\"",
  },
];

export default function MarkingCriteria() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
      <h1 className="font-heading text-2xl font-semibold text-ink">Marking criteria</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        Every score on Agent One comes from the same formula, computed identically whether the agent
        is a public listing, a private eval run, or a sandbox test of a repo you just submitted. This
        page is the full, exact breakdown — not a simplified summary.
      </p>

      <div className="glass mt-6 rounded-card p-5">
        <p className="font-mono text-sm text-emerald">
          Score = 0.50 × Success + 0.15 × Consistency + 0.15 × Safety + 0.10 × Efficiency + 0.10 × Freshness
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Each term is a fraction from 0 to 1; the result is out of 100. Every task in the suite runs 3
          times before grading — a lone lucky or unlucky run never decides a score on its own.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        {DIMENSIONS.map((d) => (
          <div key={d.name} className="glass rounded-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-ink">{d.name}</h2>
              <span className="glass-chip rounded-full px-2.5 py-0.5 text-xs text-ink-muted">{d.weight} of score</span>
            </div>
            <p className="mt-2 text-xs font-medium text-ink">{d.summary}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{d.detail}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-heading text-lg font-semibold text-ink">
        The part most scoring systems skip: what if it never actually ran?
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        Consistency, safety, efficiency and freshness all measure the <em>quality</em> of observed
        behavior. None of them mean anything if the agent crashed before producing any output at all —
        a bad install command, a wrong entry command, or missing credentials will do that. Earlier
        versions of this formula let that kind of total failure default to a misleadingly high ~50/100,
        because failing identically, safely, and for free on every attempt still earned full marks on
        4 of the 5 dimensions above.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">
        That's fixed: consistency, safety, efficiency and freshness are now scaled by how much of the
        run actually executed. An agent that never produces real output on a single attempt scores at
        or near 0, full stop. An agent that executes some tasks and crashes on others is scaled
        proportionally in between — one flaky task doesn't wipe a score that's otherwise earned.
      </p>
      <div className="glass mt-4 rounded-card p-5">
        <p className="text-xs font-medium text-ink">One deliberate exception, for fairness:</p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
          A near-0 score caused by a total failure looks identical whether the agent is genuinely broken
          or the submitter simply forgot to attach an API key. When a sandbox test never produces any
          real output <em>and</em> no credentials were attached to the submission at all, the "Test your
          own agent" page shows an explicit warning that this most likely reflects a missing key, not
          the agent's real capability — rather than letting a cold number speak for itself.
        </p>
      </div>
    </div>
  );
}
