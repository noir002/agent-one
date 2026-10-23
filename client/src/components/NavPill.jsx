import { Link } from "react-router-dom";
import Wordmark from "./Wordmark.jsx";

export default function NavPill({ me, onLogout }) {
  return (
    <div className="sticky top-4 z-40 mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4">
      <nav className="glass-refract flex w-full items-center justify-between rounded-full px-5 py-3">
        <Link to="/" className="shrink-0">
          <Wordmark />
        </Link>
        <div className="hidden items-center gap-5 text-sm text-ink-muted md:flex">
          <Link to="/" className="hover:text-ink">Explore</Link>
          <Link to="/compare" className="hover:text-ink">Compare</Link>
          <Link to="/leaderboard" className="hover:text-ink">Leaderboard</Link>
          <Link to="/submit" className="hover:text-ink">Submit</Link>
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
              <button onClick={onLogout} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink hover:bg-white/5">
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
    </div>
  );
}
