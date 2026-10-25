import { TIER_LABELS } from "@agentone/shared";

const TIER_STYLES = {
  L0: "text-tier-l0 border-tier-l0/40",
  L1: "text-tier-l1 border-tier-l1/40",
  L2: "text-tier-l2 border-tier-l2/40",
  L3: "text-tier-l3 border-tier-l3/50",
};

export default function TierBadge({ tier, showCheck = false }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-xs ${TIER_STYLES[tier] || TIER_STYLES.L0}`}>
      {tier}
      {showCheck && (tier === "L2" || tier === "L3") && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M1.5 5.2l2.3 2.3L8.5 2.8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      <span className="hidden text-ink-muted sm:inline">· {TIER_LABELS[tier]}</span>
    </span>
  );
}
