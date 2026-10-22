import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

export default function Leaderboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getLeaderboard().then(setData).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="py-6">
      <Link to="/" className="text-sm text-ink-muted hover:text-ink">← Back to forest</Link>
      <h1 className="mt-2 font-serif text-3xl font-semibold">Leaderboard</h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="mt-4 text-sm text-ink-muted">Loading…</p>}

      {data && (
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="card">
            <h2 className="font-serif text-xl font-semibold">Top agents</h2>
            <ol className="mt-3 space-y-2">
              {data.topAgents.map((agent, i) => (
                <li key={agent.slug}>
                  <Link to={`/agent/${agent.slug}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-panel">
                    <span className="text-sm">
                      <span className="mr-2 font-mono text-ink-muted">{i + 1}.</span>
                      {agent.name}
                    </span>
                    <span className="font-mono text-sm text-emerald">{agent.score}</span>
                  </Link>
                </li>
              ))}
              {data.topAgents.length === 0 && <p className="text-sm text-ink-muted">No agents yet.</p>}
            </ol>
          </div>

          <div className="card">
            <h2 className="font-serif text-xl font-semibold">Top builders</h2>
            <ol className="mt-3 space-y-2">
              {data.topBuilders.map((builder, i) => (
                <li key={builder.userId} className="flex items-center justify-between px-2 py-1.5 text-sm">
                  <span>
                    <span className="mr-2 font-mono text-ink-muted">{i + 1}.</span>
                    {builder.name}
                    {builder.college && <span className="text-ink-muted"> · {builder.college}</span>}
                  </span>
                  <span className="font-mono text-ink-muted">{builder.totalRuns} runs</span>
                </li>
              ))}
              {data.topBuilders.length === 0 && (
                <p className="text-sm text-ink-muted">No builders yet — upload an agent to be the first.</p>
              )}
            </ol>
          </div>
        </div>
      )}
    </div>
  );
}
