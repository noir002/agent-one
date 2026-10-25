import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import TierBadge from "../components/TierBadge.jsx";
import { freshnessLabel } from "../lib/format.js";

export default function Compare() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSlugs = (searchParams.get("slugs") || "").split(",").filter(Boolean);
  const [slugs, setSlugs] = useState(initialSlugs);
  const [input, setInput] = useState("");
  const [listings, setListings] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setSearchParams(slugs.length ? { slugs: slugs.join(",") } : {});
    if (slugs.length >= 2) {
      api.getCompare(slugs).then((d) => setListings(d.listings)).catch((err) => setError(err.message));
    } else {
      setListings([]);
    }
  }, [slugs]);

  const addSlug = () => {
    const slug = input.trim().toLowerCase().replace(/\s+/g, "-");
    if (slug && slugs.length < 3 && !slugs.includes(slug)) setSlugs([...slugs, slug]);
    setInput("");
  };

  const fields = [
    { key: "tier", label: "Tier", render: (l) => <TierBadge tier={l.tier} /> },
    { key: "score", label: "Score", render: (l) => l.score != null ? Math.round(l.score) : "—" },
    { key: "pricing", label: "Pricing", render: (l) => l.pricing },
    { key: "openSource", label: "Open-source", render: (l) => l.openSource ? "Yes" : "No" },
    { key: "interfaceType", label: "Interface", render: (l) => l.interfaceType },
    { key: "lastVerifiedAt", label: "Freshness", render: (l) => freshnessLabel(l.lastVerifiedAt) },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold text-ink">Compare agents</h1>
      <p className="mt-1 text-sm text-ink-muted">Add 2-3 listing slugs to compare side by side.</p>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSlug()}
          placeholder="e.g. aider"
          className="glass-chip flex-1 rounded-full px-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none"
        />
        <button onClick={addSlug} className="rounded-full bg-emerald px-4 py-2 text-sm font-medium text-bg">Add</button>
      </div>

      <div className="mt-3 flex gap-2">
        {slugs.map((s) => (
          <button key={s} onClick={() => setSlugs(slugs.filter((x) => x !== s))} className="glass-chip rounded-full px-3 py-1 text-xs text-ink-muted">
            {s} ✕
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-sm text-amber">{error}</p>}

      {listings.length === 2 && listings[0].score != null && listings[1].score != null && listings[0].category === listings[1].category && (
        <Link
          to={`/head-to-head/${listings[0].slug}/${listings[1].slug}`}
          className="mt-4 inline-block text-sm text-emerald hover:underline"
        >
          View task-by-task breakdown →
        </Link>
      )}

      {listings.length >= 2 && (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="pb-3 text-ink-muted"></th>
                {listings.map((l) => (
                  <th key={l.slug} className="pb-3">
                    <Link to={`/listing/${l.slug}`} className="font-heading text-ink hover:text-emerald">{l.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => (
                <tr key={f.key} className="border-t border-white/10">
                  <td className="py-3 text-xs text-ink-muted">{f.label}</td>
                  {listings.map((l) => <td key={l.slug} className="py-3 font-mono text-xs text-ink">{f.render(l)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
