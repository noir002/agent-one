// A throwaway fixture — NOT a catalogue listing — that implements just
// enough of the Task API contract (POST /run, SSE events) to prove the
// http runner, grading and scoring actually work end to end. Run with
// `npm run fixture:echo-agent` from /api. See the Phase 2 plan for why
// this exists: none of the 25 real seed listings have a connected endpoint
// yet, so there's nothing real to point the harness at.
import express from "express";

const PORT = process.env.FIXTURE_PORT || 4100;
const app = express();
app.use(express.json());

const CANNED_ANSWERS = [
  { match: /add\(a, b\)/i, output: "def add(a, b):\n    return a + b" },
  { match: /off-by-one/i, output: "Change `range(11)` to `range(10)`: `for i in range(10): print(i)`" },
  { match: /retrieval-augmented generation/i, output: "RAG differs from a standard LLM by retrieving relevant documents at query time and conditioning generation on them, rather than relying only on parameters learned during training. See Lewis et al., \"Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks\" (2020)." },
  { match: /REST APIs and GraphQL/i, output: "REST exposes fixed endpoints and often over- or under-fetches data, while GraphQL lets a mobile client request exactly the fields it needs in one round trip. REST is simpler to cache and debug; GraphQL reduces bandwidth on slow mobile connections at the cost of server-side query complexity." },
];

function pickAnswer(input) {
  const match = CANNED_ANSWERS.find((c) => c.match.test(input));
  return match ? match.output : "I don't have a canned answer for this task.";
}

app.post("/run", (req, res) => {
  const { input } = req.body || {};
  const output = pickAnswer(input || "");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  send("step", { tokens: 12, note: "reading task" });
  setTimeout(() => {
    send("message", { tokens: 40, text: "thinking..." });
    setTimeout(() => {
      send("final", { tokens: 60, output, cost_usd: 0.0021 });
      res.end();
    }, 100);
  }, 100);
});

app.listen(PORT, () => console.log(`[fixture] echo agent listening on http://localhost:${PORT}/run`));
