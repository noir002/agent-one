// Implements Agent One's own "docker task contract" (see
// api/src/harness/runners/dockerRunner.js): read /task/input.json, write
// /task/output.json. A throwaway test fixture proving the L3 sandbox
// mechanics work — not a real agent.
const fs = require("fs");

const input = JSON.parse(fs.readFileSync("/task/input.json", "utf-8"));

const CANNED = [
  { match: /add\(a, b\)/i, output: "def add(a, b):\n    return a + b" },
];
const found = CANNED.find((c) => c.match.test(input.input || ""));
const output = found ? found.output : "I don't have a canned answer for this task.";

console.log(`[docker-echo-agent] processing task: ${(input.input || "").slice(0, 60)}`);
fs.writeFileSync("/task/output.json", JSON.stringify({ output, tokens: 50, cost_usd: 0 }));
console.log("[docker-echo-agent] wrote output.json");
