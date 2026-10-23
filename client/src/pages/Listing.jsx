import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import TierBadge from "../components/TierBadge.jsx";
import { freshnessLabel, initials } from "../lib/format.js";
import { CATEGORY_LABELS } from "@agentone/shared";

export default function Listing({ me }) {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [claimMethod, setClaimMethod] = useState("dns");
  const [claimResult, setClaimResult] = useState(null);
  const [claimError, setClaimError] = useState("");
  const [domainCheck, setDomainCheck] = useState(null);
  const [tryInput, setTryInput] = useState("");
  const [tryOutput, setTryOutput] = useState("");
  const [tryEvents, setTryEvents] = useState([]);
  const [tryRunning, setTryRunning] = useState(false);
  const [tryError, setTryError] = useState("");
  const [byokProvider, setByokProvider] = useState("");
  const [byokKey, setByokKey] = useState("");
  const [quickRunInput, setQuickRunInput] = useState("");
  const [quickRun, setQuickRun] = useState(null);
  const [quickRunError, setQuickRunError] = useState("");
  const [quickRunLoading, setQuickRunLoading] = useState(false);
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [scoreHistory, setScoreHistory] = useState([]);

  const load = () => api.getListing(slug).then(setData).catch((err) => setError(err.message));
  useEffect(() => { load(); }, [slug]);
  useEffect(() => {
    api.getReviews(slug).then((d) => setReviews(d.reviews)).catch(() => {});
    api.getScoreHistory(slug).then((d) => setScoreHistory(d.history)).catch(() => {});
  }, [slug]);

  const handleClaim = async () => {
    setClaimError("");
    try {
      const result = await api.submitClaim({ listingId: data.listing._id, verifyMethod: claimMethod, fastTrack: false });
      setClaimResult(result);
    } catch (err) {
      setClaimError(err.message);
    }
  };

  const handleCheckDomain = async () => {
    try {
      const result = await api.checkClaimDomain(claimResult.claim._id);
      setDomainCheck(result);
    } catch (err) {
      setClaimError(err.message);
    }
  };

  const handleTryIt = async () => {
    setTryError("");
    setTryOutput("");
    setTryEvents([]);
    setTryRunning(true);
    try {
      const body = { input: tryInput };
      if (byokProvider && byokKey) body.byok = { provider: byokProvider, apiKey: byokKey };
      const res = await fetch(`/api/flagships/${slug}/try`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop();
        for (const raw of chunks) {
          const eventMatch = raw.match(/^event: (.+)$/m);
          const dataMatch = raw.match(/^data: (.+)$/m);
          if (!eventMatch || !dataMatch) continue;
          const event = eventMatch[1];
          const data = JSON.parse(dataMatch[1]);
          setTryEvents((prev) => [...prev, { event, data }]);
          if (event === "final") setTryOutput(data.output || "");
        }
      }
    } catch (err) {
      setTryError(err.message);
    }
    setTryRunning(false);
  };

  const handleQuickRun = async () => {
    setQuickRunError("");
    setReviewSubmitted(false);
    setQuickRunLoading(true);
    try {
      const result = await api.quickRun(slug, quickRunInput);
      setQuickRun(result.quickRun);
    } catch (err) {
      setQuickRunError(err.message);
    }
    setQuickRunLoading(false);
  };

  const handleSubmitReview = async () => {
    setReviewError("");
    try {
      await api.submitReview(slug, { quickRunId: quickRun._id, stars: reviewStars, text: reviewText });
      setReviewSubmitted(true);
      api.getReviews(slug).then((d) => setReviews(d.reviews)).catch(() => {});
    } catch (err) {
      setReviewError(err.message);
    }
  };

  if (error) return <p className="py-16 text-center text-amber">{error}</p>;
  if (!data) return <p className="py-16 text-center text-ink-muted">Loading…</p>;

  const { listing, manifest } = data;
  const canQuickRun = !listing.isFlagship && listing.manifestId && ["http", "mcp"].includes(listing.interfaceType);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to="/" className="text-sm text-ink-muted hover:text-ink">← Back to the forest</Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 font-heading text-lg text-ink-muted">
            {initials(listing.name)}
          </div>
          <div>
            <h1 className="font-heading text-2xl font-semibold text-ink">{listing.name}</h1>
            <p className="text-sm text-ink-muted">{CATEGORY_LABELS[listing.category]} · {listing.type}</p>
          </div>
        </div>
        {listing.score != null && (
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-violet/40 font-mono text-lg text-violet">
            {Math.round(listing.score)}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <TierBadge tier={listing.tier} showCheck />
        {listing.isFlagship && (
          <span className="rounded-full border border-violet/40 px-2.5 py-0.5 text-xs text-violet">
            Built by Agent One · excluded from leaderboards
          </span>
        )}
        {listing.openSource && <span className="glass-chip rounded-full px-2.5 py-0.5 text-xs text-ink-muted">Open-source</span>}
        <span className="glass-chip rounded-full px-2.5 py-0.5 text-xs text-ink-muted">{listing.pricing}</span>
        <span className="text-xs text-ink-muted">{freshnessLabel(listing.lastVerifiedAt)}</span>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-ink-muted">{listing.description || listing.tagline}</p>

      <div className="mt-6 flex flex-wrap gap-3 text-sm">
        <a href={listing.sourceUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-ink hover:bg-white/5">
          Visit site ↗
        </a>
        {listing.repoUrl && (
          <a href={listing.repoUrl} target="_blank" rel="noopener noreferrer" className="rounded-full border border-white/15 px-4 py-2 text-ink hover:bg-white/5">
            View repo ↗
          </a>
        )}
      </div>

      {listing.isFlagship && (
        <section className="glass mt-8 rounded-card p-6">
          <h2 className="font-heading text-sm font-semibold text-ink">Try it</h2>
          <p className="mt-1 text-xs text-ink-muted">
            5 free tries a day. Its reasoning runs on Agent One's own LLM config (mock by default —
            see the README); paste your own key below to use your model for just this run. Never stored.
          </p>
          <textarea
            value={tryInput}
            onChange={(e) => setTryInput(e.target.value)}
            placeholder={listing.slug === "repo-fixer" ? "Describe the bug to fix…" : "Ask a research question…"}
            rows={3}
            className="mt-3 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus:border-emerald"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <select value={byokProvider} onChange={(e) => setByokProvider(e.target.value)} className="glass-chip rounded-full px-3 py-1.5 text-xs text-ink">
              <option value="">Use Agent One's config</option>
              <option value="gemini">My Gemini key</option>
              <option value="groq">My Groq key</option>
            </select>
            {byokProvider && (
              <input
                type="password"
                value={byokKey}
                onChange={(e) => setByokKey(e.target.value)}
                placeholder="API key (this request only)"
                className="glass-chip flex-1 rounded-full px-3 py-1.5 text-xs text-ink focus:outline-none"
              />
            )}
          </div>
          <button
            onClick={handleTryIt}
            disabled={tryRunning || !tryInput.trim()}
            className="mt-3 rounded-full bg-emerald px-4 py-1.5 text-xs font-medium text-bg hover:opacity-90 disabled:opacity-50"
          >
            {tryRunning ? "Running…" : "Run"}
          </button>
          {tryError && <p className="mt-2 text-xs text-amber">{tryError}</p>}
          {(tryEvents.length > 0 || tryOutput) && (
            <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 font-mono text-xs text-ink-muted">
              {tryEvents.map((e, i) => (
                <div key={i} className="mb-1">
                  <span className="text-emerald">{e.event}</span>: {JSON.stringify(e.data).slice(0, 160)}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {listing.scoreParts && (
        <section className="glass mt-8 rounded-card p-6">
          <h2 className="font-heading text-sm font-semibold text-ink">Score breakdown</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-xs text-ink-muted sm:grid-cols-5">
            {Object.entries(listing.scoreParts).map(([k, v]) => (
              <div key={k}>
                <div className="text-ink">{Math.round(v * 100)}%</div>
                <div className="capitalize">{k}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {scoreHistory.length > 1 && (
        <section className="glass mt-8 rounded-card p-6">
          <h2 className="font-heading text-sm font-semibold text-ink">Score history</h2>
          <div className="mt-4 flex h-20 items-end gap-1.5">
            {scoreHistory.map((snap, i) => (
              <div
                key={i}
                title={`${Math.round(snap.score)} on ${new Date(snap.computedAt).toLocaleDateString()}`}
                className="flex-1 rounded-t bg-violet/50"
                style={{ height: `${Math.max(4, snap.score)}%` }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            {Math.round(scoreHistory[0].score)} → {Math.round(scoreHistory[scoreHistory.length - 1].score)} across {scoreHistory.length} runs
          </p>
        </section>
      )}

      <section className="glass mt-8 rounded-card p-6">
        <h2 className="font-heading text-sm font-semibold text-ink">Badge</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Embed this on your README or site — it updates itself as the score does.
        </p>
        <img src={api.badgeUrl(listing.slug)} alt={`Agent One badge for ${listing.name}`} className="mt-3" />
        <div className="mt-3 space-y-2">
          <div>
            <p className="text-xs text-ink-muted">Markdown</p>
            <code className="mt-1 block overflow-x-auto rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-ink">
              {`[![Agent One](${window.location.origin}${api.badgeUrl(listing.slug)})](${window.location.origin}/listing/${listing.slug})`}
            </code>
          </div>
          <div>
            <p className="text-xs text-ink-muted">HTML</p>
            <code className="mt-1 block overflow-x-auto rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-ink">
              {`<a href="${window.location.origin}/listing/${listing.slug}"><img src="${window.location.origin}${api.badgeUrl(listing.slug)}" alt="Agent One badge"></a>`}
            </code>
          </div>
        </div>
      </section>

      {canQuickRun && (
        <section className="glass mt-8 rounded-card p-6">
          <h2 className="font-heading text-sm font-semibold text-ink">Run it, then review</h2>
          <p className="mt-1 text-xs text-ink-muted">
            This triggers a real, one-off run against the connected agent — not part of its benchmark score.
            Sign in required; up to 10 runs a day.
          </p>
          {!me?.user ? (
            <Link to="/login" className="mt-3 inline-block text-sm text-emerald hover:underline">Sign in to run it</Link>
          ) : (
            <>
              <textarea
                value={quickRunInput}
                onChange={(e) => setQuickRunInput(e.target.value)}
                placeholder="Give it something to do…"
                rows={3}
                className="mt-3 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus:border-emerald"
              />
              <button
                onClick={handleQuickRun}
                disabled={quickRunLoading || !quickRunInput.trim()}
                className="mt-3 rounded-full bg-emerald px-4 py-1.5 text-xs font-medium text-bg hover:opacity-90 disabled:opacity-50"
              >
                {quickRunLoading ? "Running…" : "Run"}
              </button>
              {quickRunError && <p className="mt-2 text-xs text-amber">{quickRunError}</p>}
              {quickRun && (
                <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3 text-xs">
                  <p className={quickRun.status === "error" ? "text-amber" : "text-ink-muted"}>
                    {quickRun.status === "error" ? quickRun.errorMessage || "The run failed." : quickRun.output}
                  </p>
                  <Link to={`/runs/quick/${quickRun._id}`} className="mt-2 inline-block text-emerald hover:underline">
                    View full trace & share →
                  </Link>
                </div>
              )}
              {quickRun && !reviewSubmitted && (
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        onClick={() => setReviewStars(n)}
                        className={`text-lg ${n <= reviewStars ? "text-amber" : "text-ink-muted"}`}
                      >★</button>
                    ))}
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="What did you think? (optional)"
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus:border-emerald"
                  />
                  <button onClick={handleSubmitReview} className="mt-2 rounded-full bg-emerald px-4 py-1.5 text-xs font-medium text-bg hover:opacity-90">
                    Submit review
                  </button>
                  {reviewError && <p className="mt-2 text-xs text-amber">{reviewError}</p>}
                </div>
              )}
              {reviewSubmitted && <p className="mt-3 text-xs text-emerald">Review posted — thanks.</p>}
            </>
          )}
        </section>
      )}

      {reviews.length > 0 && (
        <section className="glass mt-6 rounded-card p-6">
          <h2 className="font-heading text-sm font-semibold text-ink">Reviews</h2>
          <div className="mt-3 space-y-3">
            {reviews.map((r) => (
              <div key={r._id} className="border-t border-white/10 pt-3 first:border-0 first:pt-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-amber">{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span>
                  <span className="text-ink-muted">{r.userId?.name || "Anonymous"}</span>
                  <Link to={`/runs/quick/${r.runId}`} className="text-emerald hover:underline">View run</Link>
                </div>
                {r.text && <p className="mt-1 text-xs text-ink-muted">{r.text}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {manifest && (
        <section className="glass mt-6 rounded-card p-6">
          <h2 className="font-heading text-sm font-semibold text-ink">Manifest</h2>
          <dl className="mt-3 space-y-1 font-mono text-xs text-ink-muted">
            <div>version: {manifest.version}</div>
            <div>interface: {manifest.interface?.type}</div>
            <div>tools: {manifest.tools?.join(", ") || "none"}</div>
            <div>network: {manifest.permissions?.network}</div>
          </dl>
        </section>
      )}

      {!listing.ownerId && !listing.isFlagship && (
        <section className="glass mt-6 rounded-card p-6">
          <h2 className="font-heading text-sm font-semibold text-ink">Is this your agent?</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Claim it by verifying you control {new URL(listing.sourceUrl).hostname}.
          </p>
          {!me?.user ? (
            <Link to="/login" className="mt-3 inline-block text-sm text-emerald hover:underline">Sign in to claim it</Link>
          ) : !claimResult ? (
            <div className="mt-3 flex items-center gap-3">
              <select value={claimMethod} onChange={(e) => setClaimMethod(e.target.value)} className="glass-chip rounded-full px-3 py-1.5 text-xs text-ink">
                <option value="dns">DNS TXT record</option>
                <option value="meta-tag">Meta tag</option>
              </select>
              <button onClick={handleClaim} className="rounded-full bg-emerald px-4 py-1.5 text-xs font-medium text-bg hover:opacity-90">
                Start claim
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-xs text-ink-muted">
              <p>{claimResult.instructions}</p>
              <button onClick={handleCheckDomain} className="rounded-full border border-white/15 px-4 py-1.5 text-ink hover:bg-white/5">
                Check now
              </button>
              {domainCheck && (
                <p className={domainCheck.domainVerified ? "text-emerald" : "text-amber"}>
                  {domainCheck.domainVerified
                    ? "Domain verified — your claim is now in the admin review queue for an L1 smoke test."
                    : domainCheck.reason}
                </p>
              )}
            </div>
          )}
          {claimError && <p className="mt-2 text-xs text-amber">{claimError}</p>}
        </section>
      )}
    </div>
  );
}
