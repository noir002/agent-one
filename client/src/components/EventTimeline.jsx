// Renders a recorded run's event trace (TaskRun/QuickRun's `events[]` —
// {type, timestamp, tokens, data}) as a step-by-step timeline. Shared by
// every public run page (Phase 6).
export default function EventTimeline({ events }) {
  if (!events || events.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-xs text-ink-muted">
      {events.map((e, i) => (
        <div key={i} className="mb-1.5 border-b border-white/5 pb-1.5 last:mb-0 last:border-0 last:pb-0">
          <span className="text-emerald">{e.type}</span>
          {e.tokens > 0 && <span className="text-ink-muted"> · {e.tokens} tokens</span>}
          <span>: {JSON.stringify(e.data).slice(0, 240)}</span>
        </div>
      ))}
    </div>
  );
}
