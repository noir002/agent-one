import { Link } from "react-router-dom";

export default function NavPill({ me, onLogout }) {
  return (
    <div className="sticky top-4 z-40 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 lg:px-8">
      <nav className="glass-refract flex flex-1 items-center justify-between gap-4 rounded-full px-5 py-3">
        {/* A plain mark, not the wordmark — the branded pill to the right
            carries "Agent वन" instead, mirroring the reference's split
            between an anonymous nav-pill logo and a separate branded CTA. */}
        <Link to="/" className="shrink-0" aria-label="Agent One home">
          <span className="block h-6 w-11 rounded-full border-[2.5px] border-ink" />
        </Link>
        <div className="hidden items-center gap-5 text-sm text-ink-muted md:flex">
          <Link to="/" className="hover:text-ink">Explore</Link>
          <Link to="/compare" className="hover:text-ink">Compare</Link>
          <Link to="/leaderboard" className="hover:text-ink">Leaderboard</Link>
          <Link to="/directory" className="hover:text-ink">Directory</Link>
          <Link to="/reports" className="hover:text-ink">Reports</Link>
          <Link to="/submit" className="hover:text-ink">Submit</Link>
          <Link to="/test-agent" className="hover:text-ink">Test agent</Link>
        </div>
        <div className="flex items-center gap-3">
          {me?.user ? (
            <>
              {(me.user.role === "owner" || me.user.role === "admin") && (
                <Link to="/owner" className="hidden text-xs text-emerald hover:underline sm:inline">Owner</Link>
              )}
              {me.user.role === "admin" && (
                <Link to="/admin" className="hidden text-xs text-violet hover:underline sm:inline">Admin</Link>
              )}
              <span className="hidden text-xs text-ink-muted sm:inline">{me.user.name}</span>
              <button onClick={onLogout} className="rounded-full glass-chip px-3 py-1.5 text-xs text-ink hover:bg-ink/5">
                Sign out
              </button>
            </>
          ) : (
            <Link to="/login" className="rounded-full bg-emerald px-4 py-1.5 text-xs font-medium text-bg hover:opacity-90">
              Sign in
            </Link>
          )}
        </div>
      </nav>

      {/* The branded pill — separate from the nav itself, same shape as the
          "Submit your own agent" CTA so the two dark pills read as one
          family. "वन" sounds like "One" but means "forest" — the pun this
          site's mark has always carried, just moved here from inside the
          nav pill. */}
      <Link
        to="/"
        className="hidden shrink-0 items-center gap-3 rounded-full bg-ink p-1.5 pr-5 text-sm font-medium text-bg shadow-sm transition hover:opacity-90 sm:flex"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-bg-raised text-ink">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        Agent <span className="font-devanagari text-emerald">वन</span>
      </Link>
    </div>
  );
}
