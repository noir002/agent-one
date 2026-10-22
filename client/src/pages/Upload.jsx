import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

const GROVES = ["study", "exams", "code", "career", "research", "productivity"];
const emptyInput = () => ({ key: "", label: "", type: "text", required: true, placeholder: "", optionsText: "" });
const emptyTestCase = () => ({ inputs: {}, mustInclude: "" });

export default function Upload({ me }) {
  const [name, setName] = useState("");
  const [grove, setGrove] = useState(GROVES[0]);
  const [tagline, setTagline] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [inputs, setInputs] = useState([emptyInput()]);
  const [testCases, setTestCases] = useState([emptyTestCase(), emptyTestCase()]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const updateInput = (i, field, value) =>
    setInputs((prev) => prev.map((inp, idx) => (idx === i ? { ...inp, [field]: value } : inp)));
  const addInput = () => setInputs((prev) => [...prev, emptyInput()]);
  const removeInput = (i) => setInputs((prev) => prev.filter((_, idx) => idx !== i));

  const updateTestCaseInput = (tcIndex, key, value) =>
    setTestCases((prev) => prev.map((tc, idx) => (idx === tcIndex ? { ...tc, inputs: { ...tc.inputs, [key]: value } } : tc)));
  const updateTestCaseMustInclude = (tcIndex, value) =>
    setTestCases((prev) => prev.map((tc, idx) => (idx === tcIndex ? { ...tc, mustInclude: value } : tc)));
  const addTestCase = () => setTestCases((prev) => [...prev, emptyTestCase()]);
  const removeTestCase = (i) => setTestCases((prev) => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setResult(null);
    try {
      const payload = {
        name,
        grove,
        tagline,
        systemPrompt,
        outputFormat: "markdown",
        inputs: inputs
          .filter((i) => i.key.trim() && i.label.trim())
          .map((i) => ({
            key: i.key.trim(),
            label: i.label.trim(),
            type: i.type,
            required: i.required,
            placeholder: i.placeholder || "",
            options: i.type === "select"
              ? i.optionsText.split(",").map((s) => s.trim()).filter(Boolean)
              : undefined,
          })),
        testCases: testCases.map((tc) => ({
          inputs: tc.inputs,
          mustInclude: tc.mustInclude.split(",").map((s) => s.trim()).filter(Boolean),
        })),
      };
      const data = await api.uploadAgent(payload);
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  if (!me?.user) {
    return (
      <div className="py-16 text-center">
        <h1 className="font-serif text-2xl font-semibold">Upload an agent</h1>
        <p className="mt-2 text-sm text-ink-muted">
          <Link to="/login" className="text-emerald hover:underline">Sign in</Link> first to plant an agent in the forest.
        </p>
      </div>
    );
  }

  return (
    <div className="py-6">
      <Link to="/" className="text-sm text-ink-muted hover:text-ink">← Back to forest</Link>
      <h1 className="mt-2 font-serif text-3xl font-semibold">Upload an agent</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Agents are config only — a prompt, inputs and output format. We never run uploaded code.
        Submitting runs your test cases; an agent only publishes as a Seedling once all of them pass.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        <div className="card space-y-4">
          <h2 className="font-serif text-lg font-semibold">Basics</h2>
          <div>
            <label className="mb-1 block text-sm font-medium">Name *</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-pill px-3 py-2 text-sm outline-none focus:border-emerald" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grove *</label>
            <select value={grove} onChange={(e) => setGrove(e.target.value)}
              className="w-full rounded-lg border border-border-pill px-3 py-2 text-sm outline-none focus:border-emerald">
              {GROVES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Tagline</label>
            <input type="text" value={tagline} onChange={(e) => setTagline(e.target.value)}
              className="w-full rounded-lg border border-border-pill px-3 py-2 text-sm outline-none focus:border-emerald" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">System prompt *</label>
            <textarea required rows={4} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full rounded-lg border border-border-pill px-3 py-2 text-sm outline-none focus:border-emerald" />
          </div>
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Inputs</h2>
            <button type="button" onClick={addInput} className="btn-secondary px-3 py-1.5 text-xs">+ Add input</button>
          </div>
          {inputs.map((field, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border-card p-3 sm:grid-cols-5">
              <input placeholder="key" value={field.key} onChange={(e) => updateInput(i, "key", e.target.value)}
                className="rounded border border-border-pill px-2 py-1.5 text-xs" />
              <input placeholder="Label" value={field.label} onChange={(e) => updateInput(i, "label", e.target.value)}
                className="rounded border border-border-pill px-2 py-1.5 text-xs" />
              <select value={field.type} onChange={(e) => updateInput(i, "type", e.target.value)}
                className="rounded border border-border-pill px-2 py-1.5 text-xs">
                <option value="text">text</option>
                <option value="textarea">textarea</option>
                <option value="select">select</option>
              </select>
              {field.type === "select" ? (
                <input placeholder="options, comma-separated" value={field.optionsText}
                  onChange={(e) => updateInput(i, "optionsText", e.target.value)}
                  className="rounded border border-border-pill px-2 py-1.5 text-xs" />
              ) : (
                <input placeholder="placeholder" value={field.placeholder}
                  onChange={(e) => updateInput(i, "placeholder", e.target.value)}
                  className="rounded border border-border-pill px-2 py-1.5 text-xs" />
              )}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input type="checkbox" checked={field.required} onChange={(e) => updateInput(i, "required", e.target.checked)} />
                  required
                </label>
                {inputs.length > 1 && (
                  <button type="button" onClick={() => removeInput(i)} className="text-xs text-red-600">remove</button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Test cases (2+)</h2>
            <button type="button" onClick={addTestCase} className="btn-secondary px-3 py-1.5 text-xs">+ Add test case</button>
          </div>
          {testCases.map((tc, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-border-card p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-ink-muted">Test case {i + 1}</span>
                {testCases.length > 2 && (
                  <button type="button" onClick={() => removeTestCase(i)} className="text-xs text-red-600">remove</button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {inputs.filter((f) => f.key.trim()).map((field) => (
                  <input key={field.key} placeholder={field.label || field.key}
                    value={tc.inputs[field.key] || ""}
                    onChange={(e) => updateTestCaseInput(i, field.key, e.target.value)}
                    className="rounded border border-border-pill px-2 py-1.5 text-xs" />
                ))}
              </div>
              <input placeholder="must-include terms, comma-separated (e.g. example, summary)"
                value={tc.mustInclude} onChange={(e) => updateTestCaseMustInclude(i, e.target.value)}
                className="w-full rounded border border-border-pill px-2 py-1.5 text-xs" />
            </div>
          ))}
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-50">
          {submitting ? "Running checks…" : "Submit for checks"}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>

      {result && (
        <div className="card mt-6">
          <h2 className="font-serif text-lg font-semibold">
            {result.published ? "🌱 Published as a Seedling" : "Not published yet"}
          </h2>
          {!result.published && (
            <p className="mt-1 text-sm text-ink-muted">
              Fix the failing test cases below and resubmit with the same name — it'll update this agent and re-run checks.
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {result.results.map((r, i) => (
              <li key={i} className={`rounded-lg border p-2 text-sm ${r.pass ? "border-emerald-light bg-panel" : "border-red-200 bg-red-50"}`}>
                <span className={r.pass ? "text-emerald" : "text-red-600"}>{r.pass ? "✓ Pass" : "✗ Fail"}</span>
                {" — "}{r.reason}
              </li>
            ))}
          </ul>
          {result.published && (
            <Link to={`/agent/${result.agent.slug}`} className="btn-primary mt-4 inline-block">
              View your agent →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
