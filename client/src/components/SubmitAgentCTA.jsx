import { Link } from "react-router-dom";

// The site's signature pill CTA — a dark rounded-full button with a white
// icon badge on the left, modeled on a reference mockup's "Start Build"
// control. Always points at the self-service repo-sandbox-testing flow
// (TestAgent.jsx), Agent One's actual "bring your own agent" feature.
export default function SubmitAgentCTA({ className = "" }) {
  return (
    <Link
      to="/test-agent"
      className={`group inline-flex items-center gap-4 rounded-full bg-ink p-2 pr-6 text-sm font-medium text-bg shadow-sm transition hover:opacity-90 ${className}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-bg-raised text-ink">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      Submit your own agent
    </Link>
  );
}
