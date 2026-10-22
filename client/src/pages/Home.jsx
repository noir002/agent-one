import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import SearchBar from "../components/SearchBar.jsx";
import CategoryPills from "../components/CategoryPills.jsx";
import Filters from "../components/Filters.jsx";
import ListingCard from "../components/ListingCard.jsx";
import ForestView from "../scenes/Forest/ForestView.jsx";

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [listings, setListings] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [filters, setFilters] = useState({ tier: "", type: "", pricing: "", interfaceType: "", openSource: "" });
  const [view, setView] = useState("forest"); // "forest" | "grid"
  const [error, setError] = useState("");

  useEffect(() => {
    api.getCategories().then((d) => setCategories(d.categories)).catch(() => {});
    api.getStats().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    api.getListings({ category, q: query, ...filters })
      .then((d) => setListings(d.listings))
      .catch((err) => setError(err.message));
  }, [category, query, filters]);

  const groves = categories.map((c) => ({
    category: c.category,
    listings: listings.filter((l) => l.category === c.category),
  }));

  const recentlyVerified = [...listings]
    .filter((l) => l.lastVerifiedAt)
    .sort((a, b) => new Date(b.lastVerifiedAt) - new Date(a.lastVerifiedAt))
    .slice(0, 6);

  return (
    <div>
      <section className="relative overflow-hidden pb-10 pt-6">
        <div className="aurora-hero" />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <h1 className="font-heading text-4xl font-semibold leading-tight text-ink sm:text-5xl">
            Every agent, tested.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-ink-muted">
            Other directories list agents and link out. We connect to agents, run them on standard tasks,
            and publish the trace — so every score is a real, recorded run.
          </p>

          <div className="mt-8">
            <SearchBar value={query} onChange={setQuery} />
          </div>

          <div className="mt-5">
            <CategoryPills categories={categories} active={category} onSelect={setCategory} />
          </div>

          {stats && (
            <div className="mt-8 flex justify-center gap-8 font-mono text-sm text-ink-muted">
              <div><span className="text-ink">{stats.agentsListed}</span> listed</div>
              <div><span className="text-ink">{stats.agentsTested}</span> tested</div>
              <div><span className="text-ink">{stats.runsThisWeek}</span> runs this week</div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4">
        <div className="flex items-center justify-between">
          <Filters filters={filters} onChange={setFilters} />
          <div className="glass-chip flex rounded-full p-1">
            <button
              onClick={() => setView("forest")}
              className={`rounded-full px-3 py-1 text-xs ${view === "forest" ? "bg-emerald text-bg" : "text-ink-muted"}`}
            >
              Forest
            </button>
            <button
              onClick={() => setView("grid")}
              className={`rounded-full px-3 py-1 text-xs ${view === "grid" ? "bg-emerald text-bg" : "text-ink-muted"}`}
            >
              Grid
            </button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-amber">{error}</p>}

        <div className="mt-6">
          {view === "forest" ? (
            <ForestView groves={groves} query={query} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {listings.map((l) => <ListingCard key={l.slug} listing={l} />)}
              {listings.length === 0 && !error && (
                <p className="col-span-full py-10 text-center text-sm text-ink-muted">No listings match your filters yet.</p>
              )}
            </div>
          )}
        </div>

        {recentlyVerified.length > 0 && (
          <section className="mt-16">
            <h2 className="font-heading text-xl font-semibold text-ink">Recently verified</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentlyVerified.map((l) => <ListingCard key={l.slug} listing={l} />)}
            </div>
          </section>
        )}

        <section className="my-16 glass rounded-card p-8 text-center">
          <h2 className="font-heading text-xl font-semibold text-ink">Know an agent that should be here?</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Claim a listing you own, or submit one we haven't found yet.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link to="/submit" className="rounded-full bg-emerald px-5 py-2.5 text-sm font-medium text-bg hover:opacity-90">
              Submit an agent
            </Link>
            <Link to="/how-we-make-money" className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-ink hover:bg-white/5">
              How we make money
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
