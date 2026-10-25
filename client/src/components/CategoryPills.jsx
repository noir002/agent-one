import { CATEGORY_LABELS } from "@agentone/shared";

export default function CategoryPills({ categories, active, onSelect }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        onClick={() => onSelect("")}
        className={`glass-chip rounded-full px-4 py-1.5 text-sm transition ${!active ? "text-emerald border-emerald/40" : "text-ink-muted"}`}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c.category}
          onClick={() => onSelect(c.category)}
          className={`glass-chip rounded-full px-4 py-1.5 text-sm transition ${active === c.category ? "text-emerald border-emerald/40" : "text-ink-muted"}`}
        >
          {CATEGORY_LABELS[c.category]} <span className="font-mono text-xs">· {c.count}</span>
        </button>
      ))}
    </div>
  );
}
