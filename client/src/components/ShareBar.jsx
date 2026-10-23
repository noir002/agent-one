import { useState } from "react";

// sharePath points at an /api/share/... OG stub (see api/src/routes/share.js)
// rather than the plain SPA URL: a human who opens it gets redirected to the
// SPA instantly, but a link-unfurling bot (X, LinkedIn, Discord) reads the
// server-rendered og:* tags that only that stub has.
export default function ShareBar({ sharePath, title }) {
  const url = `${window.location.origin}${sharePath}`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="mt-4 flex flex-wrap gap-2 text-xs">
      <button onClick={copy} className="rounded-full border border-white/15 px-3 py-1.5 text-ink hover:bg-white/5">
        {copied ? "Copied!" : "Copy link"}
      </button>
      <a
        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`}
        target="_blank" rel="noopener noreferrer"
        className="rounded-full border border-white/15 px-3 py-1.5 text-ink hover:bg-white/5"
      >
        Share to X
      </a>
      <a
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`}
        target="_blank" rel="noopener noreferrer"
        className="rounded-full border border-white/15 px-3 py-1.5 text-ink hover:bg-white/5"
      >
        Share to LinkedIn
      </a>
    </div>
  );
}
