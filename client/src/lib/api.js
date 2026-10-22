const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  getForest: () => request("/forest"),
  getAgents: (params = {}) => request(`/agents?${new URLSearchParams(params)}`),
  getAgent: (slug) => request(`/agents/${slug}`),
  getRun: (shareId) => request(`/runs/${shareId}`),
  getLeaderboard: (params = {}) => request(`/leaderboard?${new URLSearchParams(params)}`),
  getStats: () => request("/stats"),
  rateAgent: (slug, stars, comment) => request(`/agents/${slug}/rate`, { method: "POST", body: JSON.stringify({ stars, comment }) }),
  me: () => request("/me"),
  devLogin: (name, role) => request("/auth/dev-login", { method: "POST", body: JSON.stringify({ name, role }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
};

// SSE-style streaming over fetch + ReadableStream (works with POST, unlike EventSource).
export async function runAgentStream(slug, inputs, { onChunk, onDone, onError }) {
  const res = await fetch(`${BASE}/agents/${slug}/run`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs }),
  });

  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    onError?.(body.error || `Request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split("\n\n");
    buffer = events.pop(); // keep the last partial event in the buffer

    for (const raw of events) {
      const eventMatch = raw.match(/^event: (.+)$/m);
      const dataMatch = raw.match(/^data: (.+)$/m);
      if (!eventMatch || !dataMatch) continue;
      const event = eventMatch[1];
      const data = JSON.parse(dataMatch[1]);

      if (event === "chunk") onChunk?.(data.text);
      else if (event === "done") onDone?.(data);
      else if (event === "error") onError?.(data.message);
    }
  }
}
