import { Link } from "react-router-dom";

export default function Nav({ me, onLogout }) {
  return (
    <header className="flex items-center justify-between px-4 py-4 sm:px-8">
      <Link to="/" className="font-serif text-2xl font-semibold text-ink">
        Agent One
      </Link>
      <div className="flex items-center gap-3">
        <Link to="/leaderboard" className="hidden text-sm text-ink-muted hover:text-ink sm:inline">
          Leaderboard
        </Link>
        {me?.user ? (
          <>
            <Link to="/upload" className="hidden text-sm text-ink-muted hover:text-ink sm:inline">
              Upload
            </Link>
            <span className="hidden text-sm text-ink-muted sm:inline">
              {me.user.name} · {me.runsLeftToday} runs left today
            </span>
            <button className="btn-secondary" onClick={onLogout}>Sign out</button>
          </>
        ) : (
          <>
            <span className="hidden text-sm text-ink-muted sm:inline">
              {me?.runsLeftToday ?? 3} free runs left
            </span>
            <Link to="/login" className="btn-primary">Sign in</Link>
          </>
        )}
      </div>
    </header>
  );
}
