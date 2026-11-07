import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { CATEGORIES, CATEGORY_LABELS } from "@agentone/shared";

function initials(name) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function SecurityBadge({ security }) {
  if (!security?.checkedAt) {
    return <span className="glass-chip rounded-full px-2 py-0.5 text-[10px] text-ink-muted">Hygiene: not yet checked</span>;
  }
  const headerFrac = `${security.securityHeadersFound ?? 0}/${security.securityHeadersTotal ?? 4}`;
  return (
    <span
      title="Website security hygiene — automated, public signals (HTTPS, security headers, privacy policy). Not a test of the agent's behavior."
      className="glass-chip rounded-full px-2 py-0.5 text-[10px] text-ink-muted"
    >
      Hygiene: {security.httpsValid ? "HTTPS ✓" : "HTTPS ✗"} · headers {headerFrac}{security.privacyPolicyFound ? " · privacy ✓" : ""}
    </span>
  );
}

function Stars({ value, interactive, onRate }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          onMouseEnter={() => interactive && setHover(n)}
          onMouseLeave={() => interactive && setHover(0)}
          onClick={() => interactive && onRate?.(n)}
          className={`text-sm ${interactive ? "cursor-pointer" : ""} ${n <= display ? "text-amber" : "text-ink-muted"}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function ToolCard({ tool, me, onRated }) {
  const [rateMessage, setRateMessage] = useState("");

  const handleRate = async (stars) => {
    setRateMessage("");
    try {
      const result = await api.rateDirectoryTool(tool.slug, stars);
      onRated(tool.slug, result.rating);
    } catch (err) {
      setRateMessage(err.message);
    }
  };

  return (
    <div className="glass rounded-card p-5">
      <div className="flex items-start gap-3">
        {tool.logoUrl ? (
          <img src={tool.logoUrl} alt="" className="h-10 w-10 rounded-full bg-ink/5 object-contain" onError={(e) => { e.target.style.display = "none"; }} />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/5 font-heading text-sm text-ink-muted">
            {initials(tool.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-sm font-semibold leading-tight text-ink">{tool.name}</h3>
          <p className="text-xs text-ink-muted">{CATEGORY_LABELS[tool.category] || tool.category} · {tool.basePrice}</p>
        </div>
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-muted">{tool.description}</p>
      <p className="mt-1 text-xs text-ink-muted"><span className="text-ink">Use case:</span> {tool.useCase}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <SecurityBadge security={tool.security} />
        {tool.rankSource && (
          <span className="text-[10px] text-ink-muted">discovered via {tool.rankSource}, facts from their own site</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Stars value={Math.round(tool.rating?.average || 0)} interactive={Boolean(me?.user)} onRate={handleRate} />
          <span className="text-xs text-ink-muted">
            {tool.rating?.count > 0 ? `${tool.rating.average.toFixed(1)} (${tool.rating.count})` : "No ratings yet"}
          </span>
        </div>
        <div className="flex gap-2">
          <a href={tool.sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-ink/15 px-3 py-1 text-xs text-ink hover:bg-ink/5">
            Visit ↗
          </a>
          {tool.demoUrl ? (
            <a href={tool.demoUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-emerald px-3 py-1 text-xs font-medium text-bg hover:opacity-90">
              Try their demo ↗
            </a>
          ) : (
            <span className="rounded-full border border-ink/10 px-3 py-1 text-xs text-ink-muted">No public demo listed</span>
          )}
        </div>
      </div>
      {!me?.user && <p className="mt-2 text-xs text-ink-muted">Sign in to rate this tool.</p>}
      {rateMessage && <p className="mt-2 text-xs text-amber">{rateMessage}</p>}
    </div>
  );
}

export default function Directory({ me }) {
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("");
  const [tools, setTools] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getDirectoryTools({ category: category || undefined, sort: sort || undefined })
      .then((d) => setTools(d.tools))
      .catch((err) => setError(err.message));
  }, [category, sort]);

  const handleRated = (slug, rating) => {
    setTools((prev) => prev.map((t) => (t.slug === slug ? { ...t, rating } : t)));
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold text-ink">Community directory</h1>
      <p className="mt-1 text-sm text-ink-muted">
        A broader, lighter-weight index of real third-party AI tools — discovered via public directories but every
        fact and logo here comes from the tool's own site, never copied. No connected endpoint, no benchmark score
        (that's what the main catalogue is for) — just what's publicly known, plus community ratings.
      </p>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCategory("")} className={`rounded-full px-3 py-1.5 text-xs ${category === "" ? "bg-emerald text-bg" : "glass-chip text-ink"}`}>All</button>
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCategory(c)} className={`rounded-full px-3 py-1.5 text-xs ${category === c ? "bg-emerald text-bg" : "glass-chip text-ink"}`}>
              {CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="glass-chip rounded-full px-3 py-1.5 text-xs text-ink">
          <option value="">Discovery order</option>
          <option value="rating">Top rated</option>
          <option value="newest">Newest</option>
        </select>
      </div>

      {error && <p className="mt-4 text-sm text-amber">{error}</p>}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => <ToolCard key={tool.slug} tool={tool} me={me} onRated={handleRated} />)}
        {tools.length === 0 && !error && <p className="col-span-full py-10 text-center text-sm text-ink-muted">No tools in this category yet.</p>}
      </div>
    </div>
  );
}
