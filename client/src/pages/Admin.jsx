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

function DisputesQueue() {
  const [disputes, setDisputes] = useState([]);
  const [error, setError] = useState("");
  const [resolution, setResolution] = useState({});

  const load = () => api.getAdminDisputes().then((d) => setDisputes(d.disputes)).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const resolve = async (id) => {
    await api.resolveDispute(id, resolution[id] || "");
    setResolution((prev) => ({ ...prev, [id]: "" }));
    load();
  };

  const open = disputes.filter((d) => d.status === "open");

  return (
    <section>
      <h2 className="font-heading text-lg font-semibold text-ink">Disputes</h2>
      {error && <p className="mt-2 text-xs text-amber">{error}</p>}
      <div className="mt-3 space-y-2">
        {open.map((d) => (
          <div key={d._id} className={`glass rounded-card p-4 ${d.overdue ? "border border-amber/50" : ""}`}>
            <div className="flex items-center justify-between">
              <Link to={`/listing/${d.listingId?.slug}`} className="font-heading text-sm text-ink hover:text-emerald">
                {d.listingId?.name}
              </Link>
              {d.overdue && <span className="text-xs text-amber">overdue (due {new Date(d.dueAt).toLocaleDateString()})</span>}
            </div>
            <p className="mt-1 text-xs text-ink-muted">{d.reason}</p>
            <div className="mt-2 flex gap-2">
              <input
                value={resolution[d._id] || ""}
                onChange={(e) => setResolution((prev) => ({ ...prev, [d._id]: e.target.value }))}
                placeholder="Resolution note"
                className="glass-chip flex-1 rounded-full px-3 py-1.5 text-xs text-ink focus:outline-none"
              />
              <button
                onClick={() => resolve(d._id)}
                disabled={!resolution[d._id]?.trim()}
                className="rounded-full bg-emerald px-3 py-1.5 text-xs font-medium text-bg disabled:opacity-30"
              >
                Resolve
              </button>
            </div>
          </div>
        ))}
        {open.length === 0 && !error && <p className="text-sm text-ink-muted">No open disputes.</p>}
      </div>
    </section>
  );
}

function ScoreGapFlags() {
  const [listings, setListings] = useState([]);
  const [error, setError] = useState("");

  const load = () => api.getScoreGapFlags().then((d) => setListings(d.listings)).catch((err) => setError(err.message));
  useEffect(() => { load(); }, []);

  const clear = async (id) => { await api.clearScoreGapFlag(id); load(); };

  return (
    <section className="mt-10">
      <h2 className="font-heading text-lg font-semibold text-ink">Score gap flags</h2>
      <p className="mt-1 text-xs text-ink-muted">Listings the weekly spot-check flagged for a large score swing between re-tests.</p>
      {error && <p className="mt-2 text-xs text-amber">{error}</p>}
      <div className="mt-3 space-y-2">
        {listings.map((l) => (
          <div key={l._id} className="glass flex items-center justify-between rounded-card p-4">
            <div>
              <Link to={`/listing/${l.slug}`} className="font-heading text-sm text-ink hover:text-emerald">{l.name}</Link>
              <p className="text-xs text-amber">
                {Math.round(l.scoreGapFlag.previousScore)} → {Math.round(l.scoreGapFlag.newScore)} (gap {l.scoreGapFlag.gap.toFixed(1)}) on {new Date(l.scoreGapFlag.at).toLocaleDateString()}
              </p>
            </div>
            <button onClick={() => clear(l._id)} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink hover:bg-white/5">
              Clear flag
            </button>
          </div>
        ))}
        {listings.length === 0 && !error && <p className="text-sm text-ink-muted">No flagged listings.</p>}
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
        <DisputesQueue />
        <ListingTools />
        <ScoreGapFlags />
        <TasksPanel />
      </div>
    </div>
  );
}
