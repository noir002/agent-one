import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";

export default function SharedRun() {
  const { shareId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getRun(shareId).then(setData).catch((err) => setError(err.message));
  }, [shareId]);

  if (error) return <p className="py-10 text-center text-red-600">{error}</p>;
  if (!data) return <p className="py-10 text-center text-ink-muted">Loading…</p>;

  const { run, agent } = data;

  return (
    <div className="py-6">
      <h1 className="font-serif text-2xl font-semibold">Shared run · {agent.name}</h1>
      <p className="text-sm text-ink-muted">{agent.grove} · {agent.tagline}</p>

      <div className="card mt-4">
        <h2 className="mb-2 text-sm font-semibold uppercase text-ink-muted">Input</h2>
        <pre className="whitespace-pre-wrap break-words font-mono text-sm">{JSON.stringify(run.inputs, null, 2)}</pre>
      </div>

      <div className="card mt-4 whitespace-pre-wrap break-words font-mono text-sm">
        <h2 className="mb-2 font-sans text-sm font-semibold uppercase text-ink-muted">Output</h2>
        {run.output}
      </div>

      <Link to={`/agent/${agent.slug}`} className="btn-primary mt-6 inline-block">
        Try this agent
      </Link>
    </div>
  );
}
