import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, runAgentStream } from "../lib/api.js";

export default function Agent({ me, onRan }) {
  const { slug } = useParams();
  const [agent, setAgent] = useState(null);
  const [inputs, setInputs] = useState({});
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [shareId, setShareId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [rating, setRating] = useState(null);
  const [rateMessage, setRateMessage] = useState("");
  const [latestCheck, setLatestCheck] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);

  useEffect(() => {
    api.getAgent(slug)
      .then((data) => {
        setAgent(data.agent);
        setLatestCheck(data.latestCheck);
      })
      .catch((err) => setLoadError(err.message));
    api.getAgentRuns(slug).then((data) => setRecentRuns(data.runs)).catch(() => {});
  }, [slug]);

  const handleChange = (key, value) => setInputs((prev) => ({ ...prev, [key]: value }));

  const handleRun = async (e) => {
    e.preventDefault();
    setError("");
    setOutput("");
    setShareId(null);
    setRunning(true);
    await runAgentStream(slug, inputs, {
      onChunk: (text) => setOutput((prev) => prev + text),
      onDone: (data) => {
        setShareId(data.shareId);
        setRunning(false);
        onRan?.();
        api.getAgentRuns(slug).then((d) => setRecentRuns(d.runs)).catch(() => {});
      },
      onError: (message) => {
        setError(message);
        setRunning(false);
      },
    });
  };

  const handleRate = async (stars) => {
    setRating(stars);
    try {
      const result = await api.rateAgent(slug, stars);
      setRateMessage(`Thanks! Agent score is now ${result.score}.`);
    } catch (err) {
      setRateMessage(err.message);
    }
  };

  if (loadError) return <p className="py-10 text-center text-red-600">{loadError}</p>;
  if (!agent) return <p className="py-10 text-center text-ink-muted">Loading…</p>;

  return (
    <div className="py-6">
      <Link to="/" className="text-sm text-ink-muted hover:text-ink">← Back to forest</Link>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl font-semibold capitalize">{agent.name}</h1>
          <p className="text-sm text-ink-muted">{agent.grove} · {agent.tagline}</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-2xl text-emerald">{agent.score}</div>
          <div className="text-xs uppercase text-ink-muted">{agent.status}</div>
        </div>
      </div>

      {agent.isExternal && (
        <div className="mt-4 rounded-card border border-border-pill bg-panel px-4 py-3 text-sm text-ink-muted">
          {agent.disclaimer}{" "}
          <a href={agent.platformUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-emerald hover:underline">
            Visit the official platform ↗
          </a>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <form onSubmit={handleRun} className="card space-y-4">
          {agent.inputs.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-sm font-medium">
                {field.label}{field.required && <span className="text-emerald"> *</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  required={field.required}
                  placeholder={field.placeholder}
                  rows={4}
                  className="w-full rounded-lg border border-border-pill px-3 py-2 text-sm outline-none focus:border-emerald"
                  onChange={(e) => handleChange(field.key, e.target.value)}
                />
              ) : field.type === "select" ? (
                <select
                  required={field.required}
                  className="w-full rounded-lg border border-border-pill px-3 py-2 text-sm outline-none focus:border-emerald"
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  defaultValue=""
                >
                  <option value="" disabled>Choose…</option>
                  {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  required={field.required}
                  placeholder={field.placeholder}
                  className="w-full rounded-lg border border-border-pill px-3 py-2 text-sm outline-none focus:border-emerald"
                  onChange={(e) => handleChange(field.key, e.target.value)}
                />
              )}
            </div>
          ))}
          <button type="submit" disabled={running} className="btn-primary w-full disabled:opacity-50">
            {running ? "Running…" : "Run"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <div>
          <div className="card min-h-[200px] whitespace-pre-wrap break-words font-mono text-sm">
            {output || <span className="text-ink-muted">Output will stream here.</span>}
            {shareId && (
              <div className="mt-4 border-t border-border-card pt-3 font-sans">
                <Link to={`/r/${shareId}`} className="text-sm text-emerald hover:underline">
                  View shareable link →
                </Link>
              </div>
            )}
          </div>

          <div className="card mt-4 font-sans">
            <p className="mb-2 text-sm font-medium">Rate this agent</p>
            {me?.user ? (
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleRate(n)}
                    className={`text-xl ${rating && n <= rating ? "text-emerald" : "text-border-pill"}`}
                    aria-label={`${n} star`}
                  >
                    ★
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                <Link to="/login" className="text-emerald hover:underline">Sign in</Link> to rate this agent.
              </p>
            )}
            {rateMessage && <p className="mt-2 text-sm text-ink-muted">{rateMessage}</p>}
          </div>

          {recentRuns.length > 0 && (
            <div className="card mt-4 font-sans">
              <p className="mb-2 text-sm font-medium">Recent public runs</p>
              <ul className="space-y-1.5">
                {recentRuns.map((run) => (
                  <li key={run.shareId}>
                    <Link to={`/r/${run.shareId}`} className="block truncate text-sm text-ink-muted hover:text-emerald">
                      {run.excerpt || "(empty output)"}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {latestCheck && (
            <div className="card mt-4 font-sans">
              <p className="mb-2 text-sm font-medium">Test case results</p>
              <ul className="space-y-1.5">
                {latestCheck.results.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className={r.pass ? "text-emerald" : "text-red-600"}>{r.pass ? "✓" : "✗"}</span>
                    <span className="text-ink-muted">{r.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
