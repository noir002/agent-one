import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

const inputClass = "w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus:border-emerald";
const selectClass = "w-full rounded-lg border border-white/15 bg-bg px-3 py-2 text-sm text-ink";

function ScorePartsBar({ scoreParts }) {
  if (!scoreParts) return null;
  return (
    <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[11px] text-ink-muted">
      {Object.entries(scoreParts).map(([key, value]) => (
        <div key={key}>
          <div className="font-mono text-ink">{Math.round(value * 100)}%</div>
          <div className="capitalize">{key}</div>
        </div>
      ))}
    </div>
  );
}

export default function TestAgent({ me }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("advanced");
  const [repoUrl, setRepoUrl] = useState("");
  const [runtime, setRuntime] = useState("python");
  const [installCommand, setInstallCommand] = useState("");
  const [entryCommand, setEntryCommand] = useState("");
  const [inputMode, setInputMode] = useState("stdin");
  const [outputMode, setOutputMode] = useState("stdout");
  const [credentialRows, setCredentialRows] = useState([{ key: "", value: "" }]);
  const [useAgentOneDemoKey, setUseAgentOneDemoKey] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { submission, evalRun, listing, score, scoreParts }
  const [promoting, setPromoting] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const setCredentialRow = (i, field) => (e) => {
    const next = [...credentialRows];
    next[i] = { ...next[i], [field]: e.target.value };
    setCredentialRows(next);
  };
  const addCredentialRow = () => setCredentialRows([...credentialRows, { key: "", value: "" }]);
  const removeCredentialRow = (i) => setCredentialRows(credentialRows.filter((_, idx) => idx !== i));

  const pollSubmission = (id) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await api.getRepoSubmission(id);
        setResult(data);
        if (data.submission.status === "done" || data.submission.status === "failed") {
          clearInterval(pollRef.current);
        }
      } catch (err) {
        clearInterval(pollRef.current);
        setError(err.message);
      }
    }, 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);

    const payload = { repoUrl, mode };
    if (mode === "fast_path") {
      payload.runtimeConfig = { runtime, installCommand, entryCommand, inputMode, outputMode };
      const credentials = {};
      for (const row of credentialRows) {
        if (row.key.trim()) credentials[row.key.trim()] = row.value;
      }
      if (Object.keys(credentials).length) payload.credentials = credentials;
      payload.useAgentOneDemoKey = useAgentOneDemoKey;
    }

    try {
      const data = await api.submitRepo(payload);
      setResult(data);
      pollSubmission(data.submission._id);
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  const handlePromote = async () => {
    setPromoting(true);
    setError("");
    try {
      const { listing } = await api.promoteRepoSubmission(result.submission._id);
      navigate(`/listing/${listing.slug}`);
    } catch (err) {
      setError(err.message);
      setPromoting(false);
    }
  };

  if (!me?.user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-semibold text-ink">Test your agent</h1>
        <p className="mt-2 text-sm text-ink-muted">
          <Link to="/login" className="text-emerald hover:underline">Sign in</Link> first to submit a repo for sandbox testing.
        </p>
      </div>
    );
  }

  const status = result?.submission?.status;
  const isRunning = status === "pending" || status === "running";

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold text-ink">Test your agent</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Push your agent to GitHub, point us at it, and we'll build and run it in an isolated
        sandbox against a hidden task suite — no local pull, no API key risk on your side.
        You'll get a real 0-100 score back. Nothing publishes until you promote it.
      </p>

      <form onSubmit={handleSubmit} className="glass mt-6 space-y-4 rounded-card p-6">
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("advanced")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium ${mode === "advanced" ? "bg-emerald text-bg" : "glass-chip text-ink-muted"}`}>
            Advanced
          </button>
          <button type="button" onClick={() => setMode("fast_path")}
            className={`rounded-full px-4 py-1.5 text-xs font-medium ${mode === "fast_path" ? "bg-emerald text-bg" : "glass-chip text-ink-muted"}`}>
            Fast path
          </button>
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">GitHub repo URL *</label>
          <input required type="url" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo" className={inputClass} />
          {mode === "advanced" && (
            <p className="mt-1 text-[11px] text-ink-muted">
              Your repo needs its own Dockerfile reading <code>/task/input.json</code> and writing
              <code>/task/output.json</code>. Prefer not to write one? Use Fast path instead.
            </p>
          )}
        </div>

        {mode === "fast_path" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Runtime *</label>
                <select value={runtime} onChange={(e) => setRuntime(e.target.value)} className={selectClass}>
                  <option value="python">Python</option>
                  <option value="node">Node</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Install command</label>
                <input value={installCommand} onChange={(e) => setInstallCommand(e.target.value)}
                  placeholder="pip install -r requirements.txt" className={inputClass} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">Entry command *</label>
              <input required value={entryCommand} onChange={(e) => setEntryCommand(e.target.value)}
                placeholder="python main.py" className={inputClass} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Input mode</label>
                <select value={inputMode} onChange={(e) => setInputMode(e.target.value)} className={selectClass}>
                  <option value="stdin">stdin</option>
                  <option value="file">file</option>
                  <option value="env_var">env var</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-ink-muted">Output mode</label>
                <select value={outputMode} onChange={(e) => setOutputMode(e.target.value)} className={selectClass}>
                  <option value="stdout">stdout</option>
                  <option value="file">file</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs text-ink-muted">
                Credentials your agent needs (set as environment variables — never written into your repo)
              </label>
              {credentialRows.map((row, i) => (
                <div key={i} className="mt-2 flex gap-2">
                  <input value={row.key} onChange={setCredentialRow(i, "key")} placeholder="GROQ_API_KEY"
                    className="w-2/5 rounded-lg border border-white/15 bg-transparent px-3 py-1.5 font-mono text-xs text-ink focus:outline-none focus:border-emerald" />
                  <input type="password" value={row.value} onChange={setCredentialRow(i, "value")} placeholder="value (this run only)"
                    className="flex-1 rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-xs text-ink focus:outline-none focus:border-emerald" />
                  <button type="button" onClick={() => removeCredentialRow(i)} className="text-xs text-ink-muted hover:text-amber">×</button>
                </div>
              ))}
              <button type="button" onClick={addCredentialRow} className="mt-2 text-xs text-emerald hover:underline">+ add another</button>
            </div>

            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <input type="checkbox" checked={useAgentOneDemoKey} onChange={(e) => setUseAgentOneDemoKey(e.target.checked)} />
              Use Agent One's own demo Groq key instead (exposed to your agent as <code>GROQ_API_KEY</code>)
            </label>
          </>
        )}

        <button type="submit" disabled={submitting || isRunning}
          className="w-full rounded-full bg-emerald px-5 py-2.5 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50">
          {submitting ? "Submitting…" : isRunning ? "Running in sandbox…" : "Run sandbox test"}
        </button>
        {error && <p className="text-xs text-amber">{error}</p>}
      </form>

      {result && (
        <div className="glass mt-6 rounded-card p-6">
          <h2 className="font-heading text-sm font-semibold text-ink">
            {status === "done" && "Sandbox test complete"}
            {status === "failed" && "Sandbox test failed"}
            {isRunning && "Running in sandbox…"}
          </h2>

          {status === "done" && result.score !== null && (
            <>
              <div className="mt-2 text-4xl font-semibold text-emerald">{result.score}<span className="text-lg text-ink-muted">/100</span></div>
              <ScorePartsBar scoreParts={result.scoreParts} />
              <button onClick={handlePromote} disabled={promoting}
                className="mt-4 w-full rounded-full bg-emerald px-4 py-2 text-xs font-medium text-bg hover:opacity-90 disabled:opacity-50">
                {promoting ? "Publishing…" : "Promote to a public listing"}
              </button>
            </>
          )}

          {status === "failed" && (
            <p className="mt-2 text-xs text-amber">{result.evalRun?.error || "The sandbox run failed. Check your install/entry command and try again."}</p>
          )}

          {isRunning && (
            <p className="mt-2 text-xs text-ink-muted">Building your image and running the hidden task suite — this can take a minute.</p>
          )}
        </div>
      )}
    </div>
  );
}
