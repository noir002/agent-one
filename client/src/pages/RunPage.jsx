import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import EventTimeline from "../components/EventTimeline.jsx";
import ShareBar from "../components/ShareBar.jsx";

const OUTCOME_STYLES = {
  pass: "text-emerald border-emerald/40",
  ok: "text-emerald border-emerald/40",
  fail: "text-amber border-amber/40",
  error: "text-amber border-amber/40",
};

function TaskRunPage({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api.getTaskRun(id).then(setData).catch((err) => setError(err.message)); }, [id]);

  if (error) return <p className="py-16 text-center text-amber">{error}</p>;
  if (!data) return <p className="py-16 text-center text-ink-muted">Loading…</p>;

  const { taskRun, task, listing, passCount, totalRuns } = data;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to={listing ? `/listing/${listing.slug}` : "/"} className="text-sm text-ink-muted hover:text-ink">← Back to {listing?.name || "the forest"}</Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold text-ink">{listing?.name} · {task?.title}</h1>
        <span className={`rounded-full border px-3 py-1 font-mono text-xs uppercase ${OUTCOME_STYLES[taskRun.outcome] || "text-ink-muted border-white/15"}`}>
          {taskRun.outcome}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Benchmark run · run {taskRun.runIndex} of 3 · {passCount} of {totalRuns} recorded runs passed this task
      </p>

      <section className="glass mt-6 rounded-card p-5">
        <h2 className="font-heading text-sm font-semibold text-ink">Trace</h2>
        <div className="mt-3"><EventTimeline events={taskRun.events} /></div>
        <h2 className="mt-4 font-heading text-sm font-semibold text-ink">Final output</h2>
        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-ink-muted">{taskRun.finalOutput || "(no output)"}</p>
        {taskRun.errorMessage && <p className="mt-2 text-xs text-amber">{taskRun.errorMessage}</p>}
      </section>

      {taskRun.deterministicResult && (
        <section className="glass mt-4 rounded-card p-5">
          <h2 className="font-heading text-sm font-semibold text-ink">Deterministic checks</h2>
          <p className={`mt-1 text-xs ${taskRun.deterministicResult.pass ? "text-emerald" : "text-amber"}`}>
            {taskRun.deterministicResult.pass ? "Passed" : "Failed"}
          </p>
          {taskRun.deterministicResult.results?.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs">
              {taskRun.deterministicResult.results.map((r, i) => (
                <li key={i} className={r.pass ? "text-ink-muted" : "text-amber"}>
                  {r.pass ? "✓" : "✗"} {r.check.type}{r.reason ? ` — ${r.reason}` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {taskRun.judgeResult && (
        <section className="glass mt-4 rounded-card p-5">
          <h2 className="font-heading text-sm font-semibold text-ink">LLM judge</h2>
          <p className={`mt-1 text-xs ${taskRun.judgeResult.verdict === "PASS" ? "text-emerald" : "text-amber"}`}>
            {taskRun.judgeResult.verdict}{taskRun.judgeResult.reason ? ` — ${taskRun.judgeResult.reason}` : ""}
          </p>
        </section>
      )}

      <ShareBar sharePath={`/api/share/runs/task/${taskRun._id}`} title={`${listing?.name} on Agent One`} />
    </div>
  );
}

function QuickRunPage({ id }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { api.getQuickRun(id).then(setData).catch((err) => setError(err.message)); }, [id]);

  if (error) return <p className="py-16 text-center text-amber">{error}</p>;
  if (!data) return <p className="py-16 text-center text-ink-muted">Loading…</p>;

  const { quickRun } = data;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link to={quickRun.listingId ? `/listing/${quickRun.listingId.slug}` : "/"} className="text-sm text-ink-muted hover:text-ink">
        ← Back to {quickRun.listingId?.name || "the forest"}
      </Link>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold text-ink">{quickRun.listingId?.name}</h1>
        <span className={`rounded-full border px-3 py-1 font-mono text-xs uppercase ${OUTCOME_STYLES[quickRun.status] || "text-ink-muted border-white/15"}`}>
          {quickRun.status}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Quick run by {quickRun.userId?.name || "a visitor"} · not part of the benchmark score
      </p>

      <section className="glass mt-6 rounded-card p-5">
        <h2 className="font-heading text-sm font-semibold text-ink">Input</h2>
        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-ink-muted">{quickRun.input}</p>
        {quickRun.events?.length > 0 && (
          <>
            <h2 className="mt-4 font-heading text-sm font-semibold text-ink">Trace</h2>
            <div className="mt-2"><EventTimeline events={quickRun.events} /></div>
          </>
        )}
        <h2 className="mt-4 font-heading text-sm font-semibold text-ink">Output</h2>
        <p className="mt-2 whitespace-pre-wrap rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-ink-muted">{quickRun.output || "(no output)"}</p>
        {quickRun.errorMessage && <p className="mt-2 text-xs text-amber">{quickRun.errorMessage}</p>}
      </section>

      <ShareBar sharePath={`/api/share/runs/quick/${quickRun._id}`} title={`${quickRun.listingId?.name} on Agent One`} />
    </div>
  );
}

export default function RunPage() {
  const { kind, id } = useParams();
  if (kind === "quick") return <QuickRunPage id={id} />;
  return <TaskRunPage id={id} />;
}
