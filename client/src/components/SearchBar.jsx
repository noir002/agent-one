export default function SearchBar({ value, onChange, placeholder = "Search agents, tools and MCP servers…" }) {
  return (
    <div className="glass-refract mx-auto flex max-w-xl items-center gap-3 rounded-full px-5 py-3.5">
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" className="shrink-0 text-ink-muted" aria-hidden="true">
        <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M18 18l-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
      />
    </div>
  );
}
