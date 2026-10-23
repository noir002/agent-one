import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import TierBadge from "../components/TierBadge.jsx";

function ListingPanel({ listing }) {
  const [yamlText, setYamlText] = useState("");
  const [manifestMessage, setManifestMessage] = useState("");
  const [evalRuns, setEvalRuns] = useState([]);
  const [error, setError] = useState("");
  const [disputeReason, setDisputeReason] = useState({});
  const [disputeMessage, setDisputeMessage] = useState("");

  const load = () => api.getEvalRuns(listing.slug).then((d) => setEvalRuns(d.evalRuns)).catch((err) => setError(err.message));
  useEffect(() => { load(); }, [listing.slug]);

  const handleConnectManifest = async () => {
    setManifestMessage("");
    try {
      const result = await api.connectManifest(listing.slug, yamlText);
      setManifestMessage(result.retested ? "Manifest saved — a fresh benchmark run was queued." : "Manifest saved (no version change, no re-test queued).");
      load();
    } catch (err) {
      setManifestMessage(err.message);
    }
  };

  const handleEvaluate = async () => {
    setManifestMessage("");
    try {
      await api.requestEvaluation(listing.slug);
      setManifestMessage("Re-test queued.");
      load();
    } catch (err) {
      setManifestMessage(err.message);
    }
  };

  const handleFileDispute = async (relatedRunId) => {
    setDisputeMessage("");
    try {
      await api.fileDispute({ listingId: listing._id, relatedRunId, reason: disputeReason[relatedRunId] || "" });
      setDisputeMessage("Dispute filed — the admin queue now shows it with a 7-day review deadline.");
      setDisputeReason((prev) => ({ ...prev, [relatedRunId]: "" }));
    } catch (err) {
      setDisputeMessage(err.message);
    }
  };

  return (
    <section className="glass mt-6 rounded-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link to={`/listing/${listing.slug}`} className="font-heading text-base font-semibold text-ink hover:text-emerald">
            {listing.name}
          </Link>
          <p className="text-xs text-ink-muted">{listing.status}</p>
        </div>
        <TierBadge tier={listing.tier} showCheck />
      </div>

      <div className="mt-5">
        <h3 className="font-heading text-sm font-semibold text-ink">Manifest</h3>
        <p className="mt-1 text-xs text-ink-muted">Paste your agentone.yaml to connect or update this listing's manifest.</p>
        <textarea
          value={yamlText}
          onChange={(e) => setYamlText(e.target.value)}
          placeholder="version: 1.0.0\ninterface:\n  type: http\n  ..."
          rows={5}
          className="mt-2 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 font-mono text-xs text-ink focus:outline-none focus:border-emerald"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={handleConnectManifest} disabled={!yamlText.trim()} className="rounded-full bg-emerald px-4 py-1.5 text-xs font-medium text-bg hover:opacity-90 disabled:opacity-50">
            Save manifest
          </button>
          <button onClick={handleEvaluate} className="rounded-full border border-white/15 px-4 py-1.5 text-xs text-ink hover:bg-white/5">
            Request re-test
          </button>
        </div>
        {manifestMessage && <p className="mt-2 text-xs text-ink-muted">{manifestMessage}</p>}
      </div>

      <div className="mt-5">
        <h3 className="font-heading text-sm font-semibold text-ink">Recent runs</h3>
        {error && <p className="mt-2 text-xs text-amber">{error}</p>}
        {disputeMessage && <p className="mt-2 text-xs text-ink-muted">{disputeMessage}</p>}
        <div className="mt-2 space-y-2">
          {evalRuns.map((run) => (
            <div key={run._id} className="rounded-lg border border-white/10 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-ink">{run.status}</span>
                <span className="text-ink-muted">{new Date(run.createdAt).toLocaleString()}</span>
              </div>
              {run.failedTaskRuns?.length > 0 && (
                <div className="mt-2 space-y-2">
                  {run.failedTaskRuns.map((tr) => (
                    <div key={tr._id} className="rounded border border-amber/30 p-2">
                      <p className="text-amber">
                        task {tr.taskId} · run {tr.runIndex} · {tr.outcome}{tr.errorMessage ? ` — ${tr.errorMessage}` : ""}
                        {" "}· <Link to={`/runs/task/${tr._id}`} className="text-emerald hover:underline">View trace</Link>
                      </p>
                      <div className="mt-1 flex gap-2">
                        <input
                          value={disputeReason[tr._id] || ""}
                          onChange={(e) => setDisputeReason((prev) => ({ ...prev, [tr._id]: e.target.value }))}
                          placeholder="Why is this result wrong?"
                          className="glass-chip flex-1 rounded-full px-3 py-1 text-xs text-ink focus:outline-none"
                        />
                        <button
                          onClick={() => handleFileDispute(tr._id)}
                          disabled={!disputeReason[tr._id]?.trim()}
                          className="rounded-full border border-amber/40 px-3 py-1 text-xs text-amber disabled:opacity-40"
                        >
                          File dispute
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {evalRuns.length === 0 && !error && <p className="text-xs text-ink-muted">No runs yet.</p>}
        </div>
      </div>
    </section>
  );
}

export default function OwnerDashboard({ me }) {
  if (!me?.user) return <p className="py-16 text-center text-sm text-ink-muted">Sign in to view your owner dashboard.</p>;

  const myListings = me.myListings || [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-heading text-2xl font-semibold text-ink">Owner dashboard</h1>
      <p className="mt-1 text-sm text-ink-muted">Manage manifests, request re-tests, and dispute results for the listings you own.</p>

      {myListings.length === 0 ? (
        <p className="mt-8 text-sm text-ink-muted">
          You don't own any listings yet. Find your agent and claim it from its listing page.
        </p>
      ) : (
        myListings.map((listing) => <ListingPanel key={listing.slug} listing={listing} />)
      )}
    </div>
  );
}
