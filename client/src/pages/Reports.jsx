import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import ShareBar from "../components/ShareBar.jsx";
import { CATEGORY_LABELS } from "@agentone/shared";

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [months, setMonths] = useState([]);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getReports().then((d) => {
      setMonths(d.reports.map((r) => r.month));
      if (!searchParams.get("month") && d.reports[0]) setSearchParams({ month: d.reports[0].month });
    }).catch((err) => setError(err.message));
  }, []);

  const month = searchParams.get("month");

  useEffect(() => {
    if (!month) return;
    api.getReport(month).then(setReport).catch((err) => setError(err.message));
  }, [month]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold text-ink">State of Agents</h1>
      <p className="mt-1 text-sm text-ink-muted">A monthly snapshot of the leaderboard, generated from real recorded runs.</p>

      {months.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {months.map((m) => (
            <button
              key={m}
              onClick={() => setSearchParams({ month: m })}
              className={`rounded-full px-3 py-1.5 text-xs ${m === month ? "bg-emerald text-bg" : "glass-chip text-ink"}`}
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-xs text-amber">{error}</p>}
      {!report && !error && months.length === 0 && <p className="mt-8 text-sm text-ink-muted">No reports have been generated yet.</p>}

      {report?.report && (
        <>
          <p className="mt-6 text-sm text-ink-muted">
            <span className="font-mono text-ink">{report.report.totalBenchmarked}</span> agents benchmarked as of {report.report.month}.
          </p>

          {report.report.categories.map((c) => (
            <section key={c.category} className="glass mt-6 rounded-card p-5">
              <h2 className="font-heading text-sm font-semibold text-ink">{CATEGORY_LABELS[c.category] || c.category}</h2>
              <div className="mt-3 space-y-1.5 text-sm">
                {c.topListings.map((l, i) => (
                  <div key={l.slug} className="flex items-center justify-between">
                    <span className="text-ink-muted">{i + 1}. <Link to={`/listing/${l.slug}`} className="text-ink hover:text-emerald">{l.name}</Link></span>
                    <span className="font-mono text-violet">{Math.round(l.score)}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {report.report.mostImproved.length > 0 && (
            <section className="glass mt-6 rounded-card p-5">
              <h2 className="font-heading text-sm font-semibold text-ink">Most improved</h2>
              <div className="mt-3 space-y-1.5 text-sm">
                {report.report.mostImproved.map((l) => (
                  <div key={l.slug} className="flex items-center justify-between">
                    <Link to={`/listing/${l.slug}`} className="text-ink hover:text-emerald">{l.name}</Link>
                    <span className="font-mono text-emerald">+{Math.round(l.delta)} ({Math.round(l.previousScore)} → {Math.round(l.score)})</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {report.report.newlyBenchmarked.length > 0 && (
            <section className="glass mt-6 rounded-card p-5">
              <h2 className="font-heading text-sm font-semibold text-ink">Newly benchmarked</h2>
              <div className="mt-3 space-y-1.5 text-sm">
                {report.report.newlyBenchmarked.map((l) => (
                  <div key={l.slug} className="flex items-center justify-between">
                    <Link to={`/listing/${l.slug}`} className="text-ink hover:text-emerald">{l.name}</Link>
                    <span className="font-mono text-violet">{Math.round(l.score)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <ShareBar sharePath={`/api/share/reports/${report.report.month}`} title={`State of Agents · ${report.report.month}`} />
        </>
      )}
    </div>
  );
}
