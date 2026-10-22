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

  useEffect(() => {
    api.getAgent(slug)
      .then((data) => setAgent(data.agent))
      .catch((err) => setLoadError(err.message));
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
      },
      onError: (message) => {
        setError(message);
        setRunning(false);
      },
    });
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

        <div className="card min-h-[200px] whitespace-pre-wrap font-mono text-sm">
          {output || <span className="text-ink-muted">Output will stream here.</span>}
          {shareId && (
            <div className="mt-4 border-t border-border-card pt-3 font-sans">
              <Link to={`/r/${shareId}`} className="text-sm text-emerald hover:underline">
                View shareable link →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
