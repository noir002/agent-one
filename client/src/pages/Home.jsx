import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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

export default function Home({ me }) {
  const [groves, setGroves] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.getForest()
      .then((data) => setGroves(data.groves))
      .catch((err) => setError(err.message));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return groves;
    const q = query.toLowerCase();
    return groves
      .map((g) => ({ ...g, agents: g.agents.filter((a) => a.name.toLowerCase().includes(q)) }))
      .filter((g) => g.agents.length > 0);
  }, [groves, query]);

  return (
    <div>
      <section className="py-10 text-center sm:py-16">
        <h1 className="font-serif text-4xl font-semibold leading-tight sm:text-6xl">
          A forest of AI agents,<br />grown by students.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-ink-muted">
          24 free agents for study, exams, code, career, research and productivity. Run one, rate it, or plant your own.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <a href="#forest" className="btn-primary">Explore the forest</a>
          {!me?.user && <Link to="/login" className="btn-secondary">Sign in</Link>}
        </div>
      </section>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search agents…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-full border border-border-pill px-5 py-3 text-sm outline-none focus:border-emerald"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div id="forest" className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {filtered.map((grove) => (
          <div key={grove.grove} className="card">
            <h2 className="font-serif text-xl font-semibold capitalize">
              {GROVE_LABELS[grove.grove] || grove.grove}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {grove.agents.map((agent) => (
                <Link
                  key={agent.slug}
                  to={`/agent/${agent.slug}`}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${badgeColor(agent.badge)}`}
                  title={agent.tagline}
                >
                  {agent.name} · {agent.score}
                </Link>
              ))}
              {grove.agents.length === 0 && (
                <span className="text-sm text-ink-muted">No agents yet.</span>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && !error && (
          <p className="text-sm text-ink-muted">No agents match your search.</p>
        )}
      </div>
    </div>
  );
}
