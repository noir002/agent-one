import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { CATEGORIES, LISTING_TYPES, PRICING_MODELS } from "@agentone/shared";

export default function Submit({ me }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "", type: "agent", category: CATEGORIES[0], tagline: "", description: "",
    pricing: "unknown", openSource: false, sourceUrl: "", repoUrl: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const { listing } = await api.submitListing(form);
      navigate(`/listing/${listing.slug}`);
    } catch (err) {
      setError(err.message);
    }
    setSubmitting(false);
  };

  if (!me?.user) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="font-heading text-2xl font-semibold text-ink">Submit an agent</h1>
        <p className="mt-2 text-sm text-ink-muted">
          <Link to="/login" className="text-emerald hover:underline">Sign in</Link> first to submit a listing.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold text-ink">Submit an agent</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Facts must come from the agent's own site or repo — never copied from another directory.
        New listings start at L0 (listed); claim it afterward to move up the tiers.
      </p>

      <form onSubmit={handleSubmit} className="glass mt-6 space-y-4 rounded-card p-6">
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Name *</label>
          <input required value={form.name} onChange={set("name")} className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus:border-emerald" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Category *</label>
            <select value={form.category} onChange={set("category")} className="w-full rounded-lg border border-white/15 bg-bg px-3 py-2 text-sm text-ink">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Type *</label>
            <select value={form.type} onChange={set("type")} className="w-full rounded-lg border border-white/15 bg-bg px-3 py-2 text-sm text-ink">
              {LISTING_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Tagline</label>
          <input value={form.tagline} onChange={set("tagline")} className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus:border-emerald" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Description</label>
          <textarea rows={3} value={form.description} onChange={set("description")} className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus:border-emerald" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Source URL (its own site) *</label>
          <input required type="url" value={form.sourceUrl} onChange={set("sourceUrl")} className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus:border-emerald" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Repo URL (if open-source)</label>
          <input type="url" value={form.repoUrl} onChange={set("repoUrl")} className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus:border-emerald" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">Pricing</label>
            <select value={form.pricing} onChange={set("pricing")} className="w-full rounded-lg border border-white/15 bg-bg px-3 py-2 text-sm text-ink">
              {PRICING_MODELS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-xs text-ink-muted">
            <input type="checkbox" checked={form.openSource} onChange={set("openSource")} /> Open-source
          </label>
        </div>

        <button type="submit" disabled={submitting} className="w-full rounded-full bg-emerald px-5 py-2.5 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50">
          {submitting ? "Submitting…" : "Submit listing"}
        </button>
        {error && <p className="text-xs text-amber">{error}</p>}
      </form>
    </div>
  );
}
