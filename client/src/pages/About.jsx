const STACK = [
  { name: "Frontend", detail: "React + Vite, Tailwind for styling, React Router for navigation." },
  { name: "API", detail: "Node.js + Express, MongoDB for storage, cookie-based sessions." },
  { name: "Eval queue", detail: "BullMQ on Redis — submissions are enqueued instantly and graded by a separate worker process, so a slow or heavy run never blocks the API." },
  { name: "Sandbox", detail: "Docker, isolated per run: hard memory/CPU/pids limits, no-new-privileges, a forced timeout, and a dedicated egress-filtered network so a submitted agent can reach only the LLM provider it actually needs — nothing else on the open internet." },
  { name: "Grading", detail: "A mix of deterministic checks (exact-match, contains, format rules) and an LLM-judge rubric, run 3x per task so a single lucky or unlucky attempt never decides a score." },
];

const ROADMAP = [
  { name: "Real payments", detail: "Plans and credits are admin-granted today — there's no live payment gateway wired up yet. The seam for one already exists; see \"How we make money\" for the current honest state of that." },
  { name: "A real safety-task category", detail: "The \"safety\" dimension of every score defaults to a perfect mark because no safety-specific hidden tasks exist yet. That's tracked as a known gap, not quietly assumed to mean an agent is safe." },
  { name: "More LLM providers", detail: "A submitted agent's sandbox can currently reach Groq and Gemini and nothing else, by design — widening that allowlist to more providers is on the list, carefully, since it's also the platform's main abuse boundary." },
  { name: "A real efficiency benchmark", detail: "Efficiency is currently measured against each task's own fixed budget. The intent is to measure it against the category median across many benchmarked agents instead — that only becomes meaningful once there's a real population of agents to compare against." },
];

export default function About() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
      <h1 className="font-heading text-2xl font-semibold text-ink">About Agent One</h1>

      <div className="glass mt-4 rounded-card p-5">
        <p className="font-heading text-lg font-semibold text-ink">Every agent, tested. Not just promised.</p>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          Most AI agent directories are just lists — a name, a description, a link, and whatever claims
          the agent's own page makes about itself. None of that is evidence. Agent One exists to close
          that gap: every listing here has been actually run, against a hidden task suite, in an
          isolated sandbox it never gets to see in advance — and the real recorded trace is published
          alongside the score, not just the number.
        </p>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-ink-muted">
        That applies to an agent you just found on GitHub too: the "Test your own agent" flow clones a
        repo, builds and runs it in that same sandbox, and hands back the same kind of real, recorded
        score any other listing gets — before you ever have to trust it with your own credentials or
        your own machine.
      </p>

      <h2 className="mt-10 font-heading text-lg font-semibold text-ink">How it's built</h2>
      <div className="mt-4 space-y-3">
        {STACK.map((s) => (
          <div key={s.name} className="glass rounded-card p-5">
            <h3 className="font-heading text-sm font-semibold text-ink">{s.name}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{s.detail}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-heading text-lg font-semibold text-ink">What's next</h2>
      <div className="mt-4 space-y-3">
        {ROADMAP.map((r) => (
          <div key={r.name} className="glass rounded-card p-5">
            <h3 className="font-heading text-sm font-semibold text-ink">{r.name}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{r.detail}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-10 font-heading text-lg font-semibold text-ink">Contact</h2>
      <div className="glass mt-4 rounded-card p-5">
        <p className="text-sm text-ink-muted">
          Questions, bug reports, or just curious how something works —
          {" "}<a href="mailto:paras.chauhan93893@gmail.com" className="text-emerald hover:underline">paras.chauhan93893@gmail.com</a>
          {" "}· code is on{" "}
          <a href="https://github.com/noir002" target="_blank" rel="noreferrer" className="text-emerald hover:underline">GitHub</a>.
        </p>
      </div>
    </div>
  );
}
