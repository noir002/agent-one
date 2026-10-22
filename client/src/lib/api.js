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

  // Public
  getDisputes: () => request("/disputes"),
  getStats: () => request("/stats"),

  // Auth
  me: () => request("/me"),
  devLogin: (name, role) => request("/auth/dev-login", { method: "POST", body: JSON.stringify({ name, role }) }),
  logout: () => request("/auth/logout", { method: "POST" }),
};
