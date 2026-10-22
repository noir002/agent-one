import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TIER_COLORS, CATEGORY_LABELS } from "@agentone/shared";
import { freshnessLabel } from "../../lib/format.js";

const DIM_COLOR = "#3A4541";

function Grove({ grove, x, width, query, hovered, setHovered }) {
  const navigate = useNavigate();
  const trunkX = x + width / 2;
  const matches = (listing) => !query || listing.name.toLowerCase().includes(query.toLowerCase());

  return (
    <g>
      <line x1={trunkX} y1={260} x2={trunkX} y2={40} stroke="#0D9488" strokeWidth="2" opacity="0.6" />
      <text x={trunkX} y={30} textAnchor="middle" fill="#8FA39B" fontSize="12" fontFamily="Space Grotesk, sans-serif">
        {CATEGORY_LABELS[grove.category]}
      </text>
      {grove.listings.map((listing, i) => {
        const n = grove.listings.length;
        const ny = 240 - (i / Math.max(n - 1, 1)) * 180;
        const side = i % 2 === 0 ? 1 : -1;
        const nx = trunkX + side * (18 + (i % 3) * 14);
        const dim = !matches(listing);
        const color = dim ? DIM_COLOR : (TIER_COLORS[listing.tier] || TIER_COLORS.L0);
        const isHovered = hovered?.slug === listing.slug;
        return (
          <g key={listing.slug}>
            <line x1={trunkX} y1={ny} x2={nx} y2={ny} stroke={dim ? DIM_COLOR : "#34D399"} strokeWidth="1" opacity={dim ? 0.2 : 0.5} />
            <circle
              cx={nx}
              cy={ny}
              r={isHovered ? 8 : 5.5}
              fill={color}
              className="cursor-pointer transition-all"
              onMouseEnter={() => setHovered(listing)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => navigate(`/listing/${listing.slug}`)}
            />
          </g>
        );
      })}
    </g>
  );
}

export default function SVGForestFallback({ groves, query }) {
  const [hovered, setHovered] = useState(null);
  const width = 700;
  const perGrove = width / Math.max(groves.length, 1);

  return (
    <div className="relative mx-auto max-w-3xl">
      <svg viewBox={`0 0 ${width} 280`} className="w-full" role="img" aria-label="Forest of agent listings by category">
        <rect x="0" y="260" width={width} height="4" fill="#0B1114" />
        {groves.map((grove, i) => (
          <Grove
            key={grove.category}
            grove={grove}
            x={i * perGrove}
            width={perGrove}
            query={query}
            hovered={hovered}
            setHovered={setHovered}
          />
        ))}
      </svg>
      {hovered && (
        <div className="glass pointer-events-none absolute left-1/2 top-2 w-48 -translate-x-1/2 rounded-card p-3 text-xs">
          <p className="font-heading text-sm font-semibold text-ink">{hovered.name}</p>
          <p className="mt-0.5 text-ink-muted">{hovered.tier}{hovered.score != null ? ` · ${Math.round(hovered.score)}` : ""}</p>
          <p className="mt-0.5 text-ink-muted">{freshnessLabel(hovered.lastVerifiedAt)}</p>
        </div>
      )}
    </div>
  );
}
