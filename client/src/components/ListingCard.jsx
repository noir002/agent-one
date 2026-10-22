import { Link } from "react-router-dom";
import TierBadge from "./TierBadge.jsx";
import { freshnessLabel, isStale, initials } from "../lib/format.js";

export default function ListingCard({ listing }) {
  const stale = isStale(listing.lastVerifiedAt);
  return (
    <Link
      to={`/listing/${listing.slug}`}
      className="glass block rounded-card p-5 transition hover:border-emerald/40"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 font-heading text-sm text-ink-muted">
            {initials(listing.name)}
          </div>
          <div>
            <h3 className="font-heading text-base font-semibold leading-tight text-ink">{listing.name}</h3>
            <p className="text-xs text-ink-muted">{listing.tagline}</p>
          </div>
        </div>
        {listing.score != null && (listing.tier === "L2" || listing.tier === "L3") && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-violet/40 font-mono text-sm text-violet">
            {Math.round(listing.score)}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <TierBadge tier={listing.tier} showCheck />
        {listing.openSource && (
          <span className="glass-chip rounded-full px-2.5 py-0.5 text-xs text-ink-muted">Open-source</span>
        )}
        {listing.pricing === "free" && (
          <span className="glass-chip rounded-full px-2.5 py-0.5 text-xs text-ink-muted">Free</span>
        )}
        {listing.isSponsored && (
          <span className="rounded-full border border-amber/40 px-2.5 py-0.5 text-xs text-amber">Sponsored</span>
        )}
      </div>

      <p className={`mt-3 text-xs ${stale ? "text-amber" : "text-ink-muted"}`}>
        {freshnessLabel(listing.lastVerifiedAt)}
      </p>
    </Link>
  );
}
