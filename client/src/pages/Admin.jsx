import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

function ClaimsQueue() {
  const [claims, setClaims] = useState([]);
  const [error, setError] = useState("");

  const load = () => api.getAdminClaims().then((d) => setClaims(d.claims)).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const approve = async (id) => { await api.approveClaim(id); load(); };
  const reject = async (id) => { await api.rejectClaim(id); load(); };

  return (
    <section>
      <h2 className="font-heading text-lg font-semibold text-ink">Claim review queue</h2>
      {error && <p className="mt-2 text-xs text-amber">{error}</p>}
      <div className="mt-3 space-y-2">
        {claims.map((c) => (
          <div key={c._id} className="glass flex items-center justify-between rounded-card p-4">
            <div>
              <Link to={`/listing/${c.listingId?.slug}`} className="font-heading text-sm text-ink hover:text-emerald">
                {c.listingId?.name}
              </Link>
              <p className="text-xs text-ink-muted">
                claimed by {c.userId?.name} · {c.verifyMethod} ·{" "}
                <span className={c.domainVerified ? "text-emerald" : "text-amber"}>
                  {c.domainVerified ? "domain verified" : "domain not verified yet"}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => approve(c._id)}
                disabled={!c.domainVerified}
                className="rounded-full bg-emerald px-3 py-1.5 text-xs font-medium text-bg disabled:opacity-30"
              >
                Approve (L1 smoke test passed)
              </button>
              <button onClick={() => reject(c._id)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink hover:bg-white/5">
                Reject
              </button>
            </div>
          </div>
        ))}
        {claims.length === 0 && !error && <p className="text-sm text-ink-muted">No pending claims.</p>}
      </div>
    </section>
  );
}

function ListingTools() {
  const [slug, setSlug] = useState("");
  const [id, setId] = useState("");
  const [message, setMessage] = useState("");

  const lookup = async () => {
    try {
      const { listing } = await api.getListing(slug);
      setId(listing._id);
      setMessage(`Found: ${listing.name} (${listing.status})`);
    } catch (err) {
      setMessage(err.message);
    }
  };

  const act = async (fn) => {
    try {
      await fn(id);
      setMessage("Done.");
    } catch (err) {
      setMessage(err.message);
    }
  };

  return (
    <section className="mt-10">
      <h2 className="font-heading text-lg font-semibold text-ink">Listing tools</h2>
      <div className="glass mt-3 rounded-card p-4">
        <div className="flex gap-2">
          <input
            value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="listing slug"
            className="glass-chip flex-1 rounded-full px-3 py-1.5 text-xs text-ink focus:outline-none"
          />
          <button onClick={lookup} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink hover:bg-white/5">Look up</button>
        </div>
        {id && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => act(api.hideListing)} className="rounded-full border border-amber/40 px-3 py-1.5 text-xs text-amber">Hide</button>
            <button onClick={() => act(api.unhideListing)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink">Unhide</button>
            <button onClick={() => act(api.recheckFreshness)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink">Re-check freshness</button>
          </div>
        )}
        {message && <p className="mt-2 text-xs text-ink-muted">{message}</p>}
      </div>
    </section>
  );
}

function TasksPanel() {
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = () => api.getAdminTasks().then((d) => setTasks(d.tasks)).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const rotate = async () => {
    try {
      const { rotated } = await api.rotateTasks();
      setMessage(rotated.length ? `Rotated: ${rotated.map((r) => `${r.title} → ${r.activeVariant}`).join(", ")}` : "Nothing eligible to rotate.");
      load();
    } catch (err) {
      setMessage(err.message);
    }
  };

  const byCategory = tasks.reduce((acc, t) => {
    (acc[t.category] ||= []).push(t);
    return acc;
  }, {});

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-ink">Task suites</h2>
        <button onClick={rotate} className="rounded-full bg-emerald px-3 py-1.5 text-xs font-medium text-bg hover:opacity-90">
          Rotate a third of hidden tasks
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-amber">{error}</p>}
      {message && <p className="mt-2 text-xs text-ink-muted">{message}</p>}
      {Object.entries(byCategory).map(([category, catTasks]) => (
        <div key={category} className="glass mt-3 rounded-card p-4">
          <h3 className="font-heading text-sm font-semibold capitalize text-ink">{category}</h3>
          <table className="mt-2 w-full text-left text-xs">
            <thead>
              <tr className="text-ink-muted">
                <th className="py-1 pr-2">Title</th>
                <th className="py-1 pr-2">Visibility</th>
                <th className="py-1 pr-2">Active variant</th>
              </tr>
            </thead>
            <tbody>
              {catTasks.map((t) => (
                <tr key={t._id} className="border-t border-white/10 text-ink">
                  <td className="py-1.5 pr-2">{t.title}</td>
                  <td className="py-1.5 pr-2 text-ink-muted">
                    {t.isPublicSample ? "public" : t.isSafetyTask ? "safety" : "hidden"}
                  </td>
                  <td className="py-1.5 pr-2 font-mono text-ink-muted">
                    {t.hasParaphrase ? t.activeVariant : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

export default function Admin({ me }) {
  if (!me?.user) return <p className="py-16 text-center text-sm text-ink-muted">Sign in as an admin to view this page.</p>;
  if (me.user.role !== "admin") return <p className="py-16 text-center text-sm text-amber">Admin access required.</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold text-ink">Admin console</h1>
      <div className="mt-6 space-y-10">
        <ClaimsQueue />
        <ListingTools />
        <TasksPanel />
      </div>
    </div>
  );
}
