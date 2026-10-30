// A single adapter the runner, the judge and the flagships all call, so
// swapping providers later never touches calling code. generate() always
// returns an async generator yielding text chunks, terminating with a final
// { done: true, fullText, tokens } object.
//
// provider/apiKey can be passed per-call (not just read from process.env) —
// this is what lets the flagships' "Try it" UI support bring-your-own-key
// without mutating global env state, which would race across concurrent
// requests from different visitors.

// Agent One's own default models, used whenever a caller doesn't pass an
// explicit model (the judge, the flagships' non-BYOK path). Providers
// deprecate model IDs over time — "gemini-2.0-flash" and
// "llama-3.1-8b-instant" (the previous defaults here) both now 404 against
// their respective APIs. Confirmed current/working directly against each
// provider before picking these: gemini-3.8-flash is Google's "use for new
// projects" stable flash-tier model as of Oct 2026 (ai.google.dev/gemini-
// api/docs/models); openai/gpt-oss-20b is a real entry in Groq's live
// /v1/models list (the old Llama 3.1 ids have been removed entirely).
const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

function* wordChunks(text) {
  const words = text.split(" ");
  for (let i = 0; i < words.length; i += 1) {
    yield (i === 0 ? "" : " ") + words[i];
  }
}

async function* mockGenerate({ system, user }) {
  const lines = [
    "[MOCK] This is a simulated response — set LLM_PROVIDER and LLM_API_KEY in .env for real output.",
    "",
    `Based on the prompt:`,
    user.slice(0, 400),
    "",
    "Here is a structured answer covering the key points, with a short, clear explanation and a brief, practical example to reinforce the idea.",
    "",
    "AI can make mistakes — double-check anything important.",
  ];
  const fullText = lines.join("\n");
  for (const chunk of wordChunks(fullText)) {
    yield chunk;
    await new Promise((r) => setTimeout(r, 8));
  }
  return { fullText, tokens: Math.ceil(fullText.length / 4) };
}

async function* geminiGenerate({ system, user, model, maxTokens, apiKey }) {
  const modelName = model && model !== "default" ? model : (process.env.LLM_MODEL || DEFAULT_GEMINI_MODEL);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  // The Gemini 3 series thinks by default (high, unless told otherwise) —
  // same risk class confirmed above for Groq's gpt-oss models: at this
  // app's modest maxOutputTokens (the judge uses 150), thinking alone can
  // exhaust the budget before any answer text is written. thinking_level
  // is Gemini-3-specific (per ai.google.dev/gemini-api/docs/gemini-3), so
  // it's only sent for that family — an older Gemini model (via BYOK or a
  // manual LLM_MODEL override) wouldn't recognize the field.
  const isGemini3 = modelName.startsWith("gemini-3");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        maxOutputTokens: maxTokens || 1024,
        ...(isGemini3 ? { thinking_level: "low" } : {}),
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const fullText = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";
  for (const chunk of wordChunks(fullText)) {
    yield chunk;
  }
  return { fullText, tokens: data.usageMetadata?.totalTokenCount || Math.ceil(fullText.length / 4) };
}

async function* groqGenerate({ system, user, model, maxTokens, apiKey }) {
  const modelName = model && model !== "default" ? model : (process.env.LLM_MODEL || DEFAULT_GROQ_MODEL);
  // The default gpt-oss models are reasoning models: they spend part of the
  // token budget on a separate hidden `reasoning` field before ever writing
  // `content`, and at this app's modest maxTokens (judge calls use 150) the
  // reasoning alone can exhaust the budget, leaving content empty with
  // finish_reason "length" — confirmed directly against the live API.
  // reasoning_effort trims that overhead, but Groq 400s if a non-reasoning
  // model is sent a reasoning_effort it doesn't support (also confirmed
  // directly) — so it's only ever sent for the gpt-oss family.
  const isReasoningModel = modelName.startsWith("openai/gpt-oss");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens || 1024,
      ...(isReasoningModel ? { reasoning_effort: "low" } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`Groq error ${res.status}: ${await res.text()}`);
  }
  const data = await res.json();
  const fullText = data.choices?.[0]?.message?.content || "";
  for (const chunk of wordChunks(fullText)) {
    yield chunk;
  }
  return { fullText, tokens: data.usage?.total_tokens || Math.ceil(fullText.length / 4) };
}

export function generate(args) {
  const provider = (args.provider || process.env.LLM_PROVIDER || "mock").toLowerCase();
  const apiKey = args.apiKey || process.env.LLM_API_KEY;
  const callArgs = { ...args, apiKey };
  if (provider === "gemini") return geminiGenerate(callArgs);
  if (provider === "groq") return groqGenerate(callArgs);
  return mockGenerate(callArgs);
}
