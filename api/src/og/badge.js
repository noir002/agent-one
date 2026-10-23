import { TIER_COLORS, TIER_LABELS } from "@agentone/shared";

function escapeXml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}

function daysSince(date) {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
}

// "Live badge: an SVG badge — Agent One Verified · 87 · tested 2d ago"
// (HLD). Honest about what's actually known: an unscored L0/L1 listing
// never shows a fabricated score, just its real tier label. "Tested Nd ago"
// is when the score was last *computed* (the latest ScoreSnapshot) — not
// the separate daily site-liveness freshness check (Listing.lastVerifiedAt
// answers a different question: is the site still up).
export function renderBadgeSvg({ name, tier, score, scoreComputedAt }) {
  const color = TIER_COLORS[tier] || TIER_COLORS.L0;
  const days = daysSince(scoreComputedAt);
  const freshness = days == null ? "not yet tested" : days === 0 ? "tested today" : `tested ${days}d ago`;

  const label = score != null
    ? `Agent One · ${Math.round(score)} · ${freshness}`
    : `Agent One · ${TIER_LABELS[tier] || "Listed"}`;

  const width = 54 + label.length * 6.2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="28" viewBox="0 0 ${Math.round(width)} 28">
  <rect width="${Math.round(width)}" height="28" rx="6" fill="#05080A"/>
  <rect x="0.5" y="0.5" width="${Math.round(width) - 1}" height="27" rx="5.5" fill="none" stroke="${color}" stroke-opacity="0.5"/>
  <circle cx="14" cy="14" r="5" fill="${color}"/>
  <text x="26" y="18" font-family="Arial, sans-serif" font-size="12" fill="#E8F1EE">${escapeXml(label)}</text>
</svg>`;
}
