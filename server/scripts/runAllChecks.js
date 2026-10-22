import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../src/db.js";
import Agent from "../src/models/Agent.js";
import { runCheckForAgent } from "../src/checks/runCheck.js";

async function main() {
  await connectDB();
  const agents = await Agent.find({ status: { $ne: "hidden" } }).select("slug name grove isExternal").sort({ grove: 1, slug: 1 }).lean();

  console.log(`[checks] running test cases for ${agents.length} agents (LLM_PROVIDER=${process.env.LLM_PROVIDER || "mock"})\n`);

  const rows = [];
  for (const agent of agents) {
    const { agent: updated, check } = await runCheckForAgent(agent.slug);
    const passed = check.results.filter((r) => r.pass).length;
    rows.push({
      slug: agent.slug,
      grove: agent.grove,
      kind: agent.isExternal ? "external" : "native",
      passed: `${passed}/${check.results.length}`,
      score: updated.score,
      flags: check.safetyFlags.length,
    });
  }

  const header = ["slug", "grove", "kind", "passed", "score", "flags"];
  const widths = header.map((h) => Math.max(h.length, ...rows.map((r) => String(r[h]).length)));
  const printRow = (cells) => console.log(cells.map((c, i) => String(c).padEnd(widths[i])).join("  "));

  printRow(header);
  printRow(widths.map((w) => "-".repeat(w)));
  for (const row of rows) printRow(header.map((h) => row[h]));

  const totalCases = rows.reduce((sum, r) => sum + Number(r.passed.split("/")[1]), 0);
  const totalPassed = rows.reduce((sum, r) => sum + Number(r.passed.split("/")[0]), 0);
  console.log(`\n[checks] overall: ${totalPassed}/${totalCases} test cases passed across ${rows.length} agents`);
  if ((process.env.LLM_PROVIDER || "mock").toLowerCase() === "mock") {
    console.log("[checks] note: LLM_PROVIDER=mock returns generic templated text, so most mustInclude checks will fail here by design — set a real LLM_PROVIDER/LLM_API_KEY for a representative pass rate.");
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[checks] failed:", err);
  process.exit(1);
});
