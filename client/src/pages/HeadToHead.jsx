import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import TierBadge from "../components/TierBadge.jsx";
import ShareBar from "../components/ShareBar.jsx";
import { CATEGORY_LABELS } from "@agentone/shared";

export default function HeadToHead() {
  const { slugA, slugB } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getHeadToHead(slugA, slugB).then(setData).catch((err) => setError(err.message));
  }, [slugA, slugB]);

  if (error) return <p className="py-16 text-center text-amber">{error}</p>;
  if (!data) return <p className="py-16 text-center text-ink-muted">Loading…</p>;

  const { listingA, listingB, tasks, summary } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/leaderboard" className="text-sm text-ink-muted hover:text-ink">← Back to the leaderboard</Link>

      <h1 className="mt-4 font-heading text-2xl font-semibold text-ink">
        <Link to={`/listing/${listingA.slug}`} className="hover:text-emerald">{listingA.name}</Link>
        {" "}vs{" "}
        <Link to={`/listing/${listingB.slug}`} className="hover:text-emerald">{listingB.name}</Link>
      </h1>
      <p className="mt-1 text-sm text-ink-muted">
        {CATEGORY_LABELS[listingA.category]} · task-by-task benchmark results, from real recorded runs.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {[listingA, listingB].map((l) => (
          <div key={l.slug} className="glass rounded-card p-4 text-center">
            <h3 className="font-heading text-sm font-semibold text-ink">{l.name}</h3>
            <div className="mt-2 flex items-center justify-center gap-2">
              <TierBadge tier={l.tier} />
              <span className="font-mono text-lg text-violet">{l.score != null ? Math.round(l.score) : "—"}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-sm text-ink-muted">
        {summary.aWins} task{summary.aWins === 1 ? "" : "s"} to {listingA.name} · {summary.bWins} to {listingB.name} · {summary.ties} tied
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-ink-muted">
              <th className="pb-2">Task</th>
              <th className="pb-2 text-center">{listingA.name}</th>
              <th className="pb-2 text-center">{listingB.name}</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.taskId} className="border-t border-white/10 text-xs">
                <td className="py-2 text-ink">{t.title}{t.isSafetyTask && <span className="ml-1 text-amber">(safety)</span>}</td>
                <td className={`py-2 text-center font-mono ${t.winner === "a" ? "text-emerald" : "text-ink-muted"}`}>{t.a.passCount}/{t.a.total}</td>
                <td className={`py-2 text-center font-mono ${t.winner === "b" ? "text-emerald" : "text-ink-muted"}`}>{t.b.passCount}/{t.b.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ShareBar sharePath={`/api/share/head-to-head/${listingA.slug}/${listingB.slug}`} title={`${listingA.name} vs ${listingB.name} on Agent One`} />
    </div>
  );
}
