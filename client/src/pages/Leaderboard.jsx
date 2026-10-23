import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import TierBadge from "../components/TierBadge.jsx";
import { CATEGORIES, CATEGORY_LABELS } from "@agentone/shared";

export default function Leaderboard() {
  const [category, setCategory] = useState("");
  const [listings, setListings] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getListings({ sort: "score", category: category || undefined })
      .then((d) => setListings(d.listings.filter((l) => l.score != null)))
      .catch((err) => setError(err.message));
  }, [category]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold text-ink">Leaderboard</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Ranked by real, recorded benchmark scores. Agent One's own flagships are excluded.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={() => setCategory("")}
          className={`rounded-full px-3 py-1.5 text-xs ${category === "" ? "bg-emerald text-bg" : "glass-chip text-ink"}`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full px-3 py-1.5 text-xs ${category === c ? "bg-emerald text-bg" : "glass-chip text-ink"}`}
          >
            {CATEGORY_LABELS[c]}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-xs text-amber">{error}</p>}

      <div className="mt-6 space-y-2">
        {listings.map((listing, i) => (
          <Link
            key={listing.slug}
            to={`/listing/${listing.slug}`}
            className="glass flex items-center justify-between gap-3 rounded-card p-4 transition hover:border-emerald/40"
          >
            <div className="flex items-center gap-4">
              <span className="w-6 text-center font-mono text-sm text-ink-muted">{i + 1}</span>
              <div>
                <h3 className="font-heading text-sm font-semibold text-ink">{listing.name}</h3>
                <p className="text-xs text-ink-muted">{CATEGORY_LABELS[listing.category]}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <TierBadge tier={listing.tier} />
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-violet/40 font-mono text-sm text-violet">
                {Math.round(listing.score)}
              </div>
            </div>
          </Link>
        ))}
        {listings.length === 0 && !error && <p className="text-sm text-ink-muted">No benchmarked listings in this category yet.</p>}
      </div>
    </div>
  );
}
