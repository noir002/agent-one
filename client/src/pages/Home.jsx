import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import SearchBar from "../components/SearchBar.jsx";
import CategoryPills from "../components/CategoryPills.jsx";
import Filters from "../components/Filters.jsx";
import ListingCard from "../components/ListingCard.jsx";
import ForestView from "../scenes/Forest/ForestView.jsx";
import SubmitAgentCTA from "../components/SubmitAgentCTA.jsx";
import robotImage from "../assets/robot.webp";

export default function Home() {
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [listings, setListings] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [filters, setFilters] = useState({ tier: "", type: "", pricing: "", interfaceType: "", openSource: "" });
  const [view, setView] = useState("forest"); // "forest" | "grid"
  const [error, setError] = useState("");
  // Hero showcase card: the single top-scored listing, fetched once and
  // independent of the search/category/filter state below so it doesn't
  // disappear the moment someone starts narrowing the browse results.
  const [topListing, setTopListing] = useState(null);

  useEffect(() => {
    api.getCategories().then((d) => setCategories(d.categories)).catch(() => {});
    api.getStats().then(setStats).catch(() => {});
    api.getListings({ sort: "score" }).then((d) => setTopListing(d.listings?.[0] || null)).catch(() => {});
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

  // "Sponsored slots on category pages: always labelled 'Sponsored'" (HLD,
  // Phase 8) — only shown once a category is picked, pulled from the same
  // listings already fetched for it (no new query, no effect on their real
  // sort order elsewhere — buildListingSort and findAgentsForTask never
  // reference isSponsored).
  const sponsoredInCategory = category ? listings.filter((l) => l.isSponsored) : [];

  const recentlyVerified = [...listings]
    .filter((l) => l.lastVerifiedAt)
    .sort((a, b) => new Date(b.lastVerifiedAt) - new Date(a.lastVerifiedAt))
    .slice(0, 6);

  return (
    <div>
      <section className="relative overflow-hidden pb-16 pt-10">
        <div className="aurora-hero" />
        <div className="relative mx-auto grid max-w-5xl gap-10 px-4 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
          <div>
            <h1 className="font-heading text-4xl leading-[1.05] sm:text-5xl">
              <span className="block font-light text-ink-muted">Every agent, tested.</span>
              <span className="block font-semibold text-ink">Not just promised.</span>
            </h1>
            <p className="mt-5 max-w-md text-sm text-ink-muted">
              Other directories list agents and link out. We connect to agents, run them on standard tasks,
              and publish the trace — so every score is a real, recorded run.
            </p>

            <div className="mt-8 max-w-xl">
              <SearchBar value={query} onChange={setQuery} />
            </div>

            <div className="mt-5">
              <SubmitAgentCTA />
            </div>

            {stats && (
              <div className="mt-10 border-t border-ink/10 pt-4">
                <p className="text-xs text-ink-muted">
                  Every score comes from a real, recorded eval run — not a self-reported claim.
                </p>
                <div className="mt-2 flex gap-5 font-mono text-sm text-ink-muted">
                  <div><span className="text-ink">{stats.agentsListed}</span> listed</div>
                  <div><span className="text-ink">{stats.agentsTested}</span> tested</div>
                  <div><span className="text-ink">{stats.runsThisWeek}</span> runs this week</div>
                </div>
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-card bg-bg-raised shadow-lg ring-1 ring-ink/5">
            <div
              className="aspect-[4/3] w-full bg-cover bg-center"
              style={{ backgroundImage: `url(${robotImage})` }}
              role="img"
              aria-label="Agent One's mascot"
            />
            {topListing && (
              <Link
                to={`/listing/${topListing.slug}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-ink/5"
              >
                <div className="min-w-0">
                  <p className="truncate font-heading text-sm font-semibold text-ink">{topListing.name}</p>
                  <p className="mt-0.5 truncate font-mono text-xs text-ink-muted">
                    {topListing.score != null ? `Score ${Math.round(topListing.score)} · ${topListing.tier}` : topListing.tier}
                  </p>
                </div>
                <span className="shrink-0 pl-3 text-ink">→</span>
              </Link>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4">
        <CategoryPills categories={categories} active={category} onSelect={setCategory} />

        <div className="mt-5 flex items-center justify-between">
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

        {sponsoredInCategory.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs uppercase tracking-wide text-amber">Sponsored</h2>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sponsoredInCategory.map((l) => <ListingCard key={l.slug} listing={l} />)}
            </div>
          </section>
        )}

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
            <Link to="/how-we-make-money" className="rounded-full border border-ink/15 px-5 py-2.5 text-sm text-ink hover:bg-ink/5">
              How we make money
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
