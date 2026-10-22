import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";

const GROVE_LABELS = {
  study: "Study",
  exams: "Exams",
  code: "Code",
  career: "Career",
  research: "Research",
  productivity: "Productivity",
};

function badgeColor(badge) {
  if (badge === "verified") return "bg-emerald text-white";
  if (badge === "growing") return "bg-emerald-light text-white";
  return "bg-panel text-ink-muted";
}

export default function Grove() {
  const { grove } = useParams();
  const [agents, setAgents] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setAgents(null);
    api.getAgents({ grove, sort: "score" })
      .then((data) => setAgents(data.agents))
      .catch((err) => setError(err.message));
  }, [grove]);

  return (
    <div className="py-6">
      <Link to="/" className="text-sm text-ink-muted hover:text-ink">← Back to forest</Link>
      <h1 className="mt-2 font-serif text-3xl font-semibold capitalize">
        {GROVE_LABELS[grove] || grove}
      </h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!agents && !error && <p className="mt-4 text-sm text-ink-muted">Loading…</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {agents?.map((agent) => (
          <Link key={agent.slug} to={`/agent/${agent.slug}`} className="card block hover:border-emerald-light">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-lg font-semibold">{agent.name}</h2>
              <span className="font-mono text-sm text-emerald">{agent.score}</span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{agent.tagline}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badgeColor(agent.badge)}`}>
                {agent.badge}
              </span>
              {agent.isExternal && (
                <span className="rounded-full bg-panel px-2.5 py-1 text-xs font-medium text-ink-muted">
                  inspired by ↗
                </span>
              )}
            </div>
          </Link>
        ))}
        {agents?.length === 0 && <p className="text-sm text-ink-muted">No agents in this grove yet.</p>}
      </div>
    </div>
  );
}
