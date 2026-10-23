// Mechanical checks a human doesn't need to read the trace to verify.
// Each check either passes or fails against the recorded run — no LLM
// involved, so these are 100% reproducible and have zero marginal cost.
export function runDeterministicChecks(task, runResult) {
  const results = task.checks.map((check) => {
    if (check.type === "output_contains") {
      const terms = Array.isArray(check.value) ? check.value : [check.value];
      const lower = runResult.finalOutput.toLowerCase();
      const missing = terms.filter((t) => !lower.includes(String(t).toLowerCase()));
      return { check, pass: missing.length === 0, reason: missing.length ? `Missing: ${missing.join(", ")}` : "" };
    }
    if (check.type === "tool_called") {
      const called = runResult.events.some((e) => e.type === "tool_call" && e.data?.tool === check.value);
      return { check, pass: called, reason: called ? "" : `Tool "${check.value}" was never called.` };
    }
    if (check.type === "value_matches") {
      const pattern = new RegExp(check.value.pattern, check.value.flags || "i");
      const pass = pattern.test(runResult.finalOutput);
      return { check, pass, reason: pass ? "" : `Output did not match /${check.value.pattern}/.` };
    }
    return { check, pass: false, reason: `Unknown check type: ${check.type}` };
  });

  return {
    pass: results.length > 0 && results.every((r) => r.pass),
    results,
  };
}
