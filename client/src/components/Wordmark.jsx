// "Agent वन" — said aloud it sounds like "Agent One", but the mark is
// visually distinct. Machine-readable surfaces (title tags, alt text,
// schema.org, URLs) always use the plain-text name "Agent One" instead —
// see index.html and each page's <title>/meta.
export default function Wordmark({ className = "" }) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 font-heading font-semibold text-ink ${className}`}>
      <span>Agent</span>
      <span className="font-devanagari text-[1.1em] text-emerald leading-none">वन</span>
    </span>
  );
}
