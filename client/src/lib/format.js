import { FRESHNESS_STALE_DAYS } from "@agentone/shared";

export function daysSince(date) {
  if (!date) return null;
  const diffMs = Date.now() - new Date(date).getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

export function freshnessLabel(lastVerifiedAt) {
  const days = daysSince(lastVerifiedAt);
  if (days === null) return "Not yet verified";
  if (days === 0) return "Verified today";
  if (days === 1) return "Verified 1d ago";
  return `Verified ${days}d ago`;
}

export function isStale(lastVerifiedAt) {
  const days = daysSince(lastVerifiedAt);
  return days === null || days > FRESHNESS_STALE_DAYS;
}

export function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}
