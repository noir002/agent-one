import { TIERS, LISTING_TYPES, PRICING_MODELS, INTERFACE_TYPES } from "@agentone/shared";

function Select({ label, value, onChange, options }) {
  return (
    <label className="flex items-center gap-2 text-xs text-ink-muted">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="glass-chip rounded-full px-3 py-1.5 text-xs text-ink focus:outline-none"
      >
        <option value="">Any</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export default function Filters({ filters, onChange }) {
  const set = (key) => (value) => onChange({ ...filters, [key]: value });
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Select label="Tier" value={filters.tier} onChange={set("tier")} options={TIERS} />
      <Select label="Type" value={filters.type} onChange={set("type")} options={LISTING_TYPES} />
      <Select label="Pricing" value={filters.pricing} onChange={set("pricing")} options={PRICING_MODELS} />
      <Select label="Interface" value={filters.interfaceType} onChange={set("interfaceType")} options={INTERFACE_TYPES} />
      <label className="flex items-center gap-2 text-xs text-ink-muted">
        <input
          type="checkbox"
          checked={filters.openSource === "true"}
          onChange={(e) => set("openSource")(e.target.checked ? "true" : "")}
        />
        Open-source only
      </label>
    </div>
  );
}
