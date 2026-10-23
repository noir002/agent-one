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
  // Listings
  getListings: (params = {}) => {
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""));
    return request(`/listings?${new URLSearchParams(clean)}`);
  },
  getCategories: () => request("/listings/categories"),
  getListing: (slug) => request(`/listings/${slug}`),
  getCompare: (slugs) => request(`/listings/compare?slugs=${slugs.join(",")}`),
  submitListing: (payload) => request("/listings", { method: "POST", body: JSON.stringify(payload) }),

  // Claims
  submitClaim: (payload) => request("/claims", { method: "POST", body: JSON.stringify(payload) }),
  getMyClaims: () => request("/claims/mine"),
  checkClaimDomain: (claimId) => request(`/claims/${claimId}/check-domain`, { method: "POST" }),

  // Admin
  getAdminClaims: () => request("/admin/claims"),
  approveClaim: (id, note) => request(`/admin/claims/${id}/approve`, { method: "POST", body: JSON.stringify({ note }) }),
  rejectClaim: (id, note) => request(`/admin/claims/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
  hideListing: (id) => request(`/admin/listings/${id}/hide`, { method: "POST" }),
  unhideListing: (id) => request(`/admin/listings/${id}/unhide`, { method: "POST" }),
  recheckFreshness: (id) => request(`/admin/listings/${id}/recheck-freshness`, { method: "POST" }),
  getAdminDisputes: () => request("/admin/disputes"),
  resolveDispute: (id, resolution) => request(`/admin/disputes/${id}/resolve`, { method: "POST", body: JSON.stringify({ resolution }) }),
  getAdminTasks: () => request("/admin/tasks"),
  rotateTasks: () => request("/admin/tasks/rotate", { method: "POST" }),

  // Public
  getDisputes: () => request("/disputes"),
  getStats: () => request("/stats"),
  getPublicTasks: (category) => request(`/tasks${category ? `?category=${category}` : ""}`),
  fileDispute: (payload) => request("/disputes", { method: "POST", body: JSON.stringify(payload) }),

  // Owner dashboard
  connectManifest: (slug, yaml) => request(`/listings/${slug}/manifest`, { method: "POST", body: JSON.stringify({ yaml }) }),
  requestEvaluation: (slug) => request(`/listings/${slug}/evaluate`, { method: "POST" }),
  getEvalRuns: (slug) => request(`/listings/${slug}/eval-runs`),
  getScoreHistory: (slug) => request(`/listings/${slug}/score-history`),

  // Run-backed reviews
  quickRun: (slug, input) => request(`/listings/${slug}/quick-run`, { method: "POST", body: JSON.stringify({ input }) }),
  submitReview: (slug, payload) => request(`/listings/${slug}/review`, { method: "POST", body: JSON.stringify(payload) }),
  getReviews: (slug) => request(`/listings/${slug}/reviews`),

  // Admin: score-gap flags
  getScoreGapFlags: () => request("/admin/score-gap-flags"),
  clearScoreGapFlag: (id) => request(`/admin/listings/${id}/clear-score-gap-flag`, { method: "POST" }),

  // Auth
  me: () => request("/me"),
  devLogin: (name, role) => request("/auth/dev-login", { method: "POST", body: JSON.stringify({ name, role }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
};
