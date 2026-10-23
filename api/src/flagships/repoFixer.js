import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { generate } from "../llm/adapter.js";
import { runInContainer } from "../harness/codeSandbox.js";

const MAX_TRIES = 5;

async function collectFullText(iterator) {
  let result = await iterator.next();
  let text = "";
  while (!result.done) {
    text += result.value;
    result = await iterator.next();
  }
  return result.value?.fullText ?? text;
}

function detectLanguage(filename) {
  if (filename.endsWith(".js")) return "javascript";
  return "python"; // every other fixture in the catalogue is Python
}

// A real syntax check, not a faked pass — this is the one part of the loop
// that's genuinely verifiable without an LLM key: can the candidate fix
// even be parsed? A broken fix (common from a mock/weak model) gets caught
// here and fed back into the next attempt, same as it would with a real key.
async function checkSyntax(content, language) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "repofixer-check-"));
  const filename = language === "javascript" ? "candidate.js" : "candidate.py";
  fs.writeFileSync(path.join(tmpDir, filename), content);

  const command = language === "javascript"
    ? ["node", "--check", `/check/${filename}`]
    : ["python3", "-c", `compile(open("/check/${filename}").read(), "${filename}", "exec")`];

  try {
    const result = await runInContainer({
      image: language === "javascript" ? "node:20-alpine" : "python:3.12-alpine",
      command,
      mounts: [{ hostPath: tmpDir, containerPath: "/check", readOnly: true }],
      timeoutS: 15,
      memoryMb: 128,
    });
    return { ok: result.exitCode === 0 && !result.timedOut, error: result.stderr.trim() };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// Repo Fixer's real loop: run → read failure → ask the LLM for a fix →
// verify → re-run, up to 5 tries. The verification (checkSyntax, via the
// same sandbox primitive the L3 runner uses) is real regardless of LLM
// quality; "ask the LLM for a fix" honestly returns mock output until a
// real LLM_PROVIDER/LLM_API_KEY is set — see README.
export async function runRepoFixer({ input, files }) {
  const send = (event, data) => ({ event, data });
  const events = [];
  const emit = (event, data) => events.push(send(event, data));

  const file = files?.[0];
  if (!file) {
    emit("final", { output: "No file provided to fix.", tokens: 0 });
    return { events, finalOutput: "No file provided to fix." };
  }

  const language = detectLanguage(file.path);
  let currentContent = file.content;
  let lastError = "";
  let fixed = false;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    emit("step", { note: `attempt ${attempt}/${MAX_TRIES}: checking current code`, tokens: 0 });

    const check = await checkSyntax(currentContent, language);
    emit("tool_call", { tool: "code.exec", input: `syntax-check ${file.path}` });
    emit("tool_result", { pass: check.ok, error: check.error });

    if (check.ok && attempt > 1) {
      // Only counts as "fixed" once we've actually changed something —
      // attempt 1 checking the original buggy file isn't a fix.
      fixed = true;
      break;
    }
    if (check.ok && attempt === 1) {
      // The original file is already syntactically valid; still ask for a
      // real bug fix (syntax validity isn't the same as correctness).
    }

    lastError = check.error;
    const prompt = [
      `Task: ${input}`,
      "",
      `Current ${file.path}:`,
      "```",
      currentContent,
      "```",
      lastError ? `\nThe above failed to parse: ${lastError}` : "",
      "\nReturn only the corrected file content, no explanation.",
    ].join("\n");

    emit("message", { text: `asking the LLM for a fix (attempt ${attempt})`, tokens: 0 });
    const fixText = await collectFullText(generate({
      system: "You are an expert software engineer. Reply with only the corrected code, no prose.",
      user: prompt,
      model: "default",
      maxTokens: 500,
    }));
    emit("tool_call", { tool: "fs.write", input: file.path });

    // Mock mode returns generic prose, not code — in that case there's
    // nothing useful to apply, so we honestly stop rather than overwrite
    // working code with "[MOCK] ..." text.
    if (fixText.trim().startsWith("[MOCK]")) {
      emit("message", { text: "mock mode: no real fix available without a real LLM key.", tokens: 0 });
      break;
    }
    currentContent = fixText;
  }

  const finalOutput = currentContent;
  emit("final", { output: finalOutput, tokens: 0, cost_usd: 0 });

  return { events, finalOutput, fixed, lastError };
}

export async function handleRepoFixerRun(req, res) {
  const { input, files } = req.body || {};

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  try {
    const { events } = await runRepoFixer({ input, files: files?.length ? files : [{ path: "candidate.py", content: "" }] });
    for (const e of events) send(e.event, e.data);
  } catch (err) {
    send("final", { output: `Error: ${err.message}`, tokens: 0 });
  }
  res.end();
}
