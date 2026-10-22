// A single adapter the runner and the check job both call, so swapping
// providers later never touches calling code. generate() always returns
// an async generator yielding text chunks, terminating with a final
// { done: true, fullText, tokens } object.

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

async function* geminiGenerate({ system, user, model, maxTokens }) {
  const apiKey = process.env.LLM_API_KEY;
  const modelName = model && model !== "default" ? model : (process.env.LLM_MODEL || "gemini-2.0-flash");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: maxTokens || 1024 },
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

async function* groqGenerate({ system, user, model, maxTokens }) {
  const apiKey = process.env.LLM_API_KEY;
  const modelName = model && model !== "default" ? model : (process.env.LLM_MODEL || "llama-3.1-8b-instant");
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
  const provider = (process.env.LLM_PROVIDER || "mock").toLowerCase();
  if (provider === "gemini") return geminiGenerate(args);
  if (provider === "groq") return groqGenerate(args);
  return mockGenerate(args);
}
