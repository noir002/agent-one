import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

export default function Login({ onLoggedIn }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("user");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.devLogin(name, role);
      onLoggedIn?.();
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="font-heading text-2xl font-semibold text-ink">Sign in</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Dev-mode login for the prototype. Real GitHub/Google sign-in replaces this once configured
        (and "owner" is granted only through an approved claim, not here).
      </p>
      <form onSubmit={handleSubmit} className="glass mt-6 space-y-4 rounded-card p-6">
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Name</label>
          <input
            type="text" required value={name} onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-ink focus:outline-none focus:border-emerald"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-ink-muted">Role (for testing)</label>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded-lg border border-white/15 bg-bg px-3 py-2 text-sm text-ink">
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" className="w-full rounded-full bg-emerald px-5 py-2.5 text-sm font-medium text-bg hover:opacity-90">
          Sign in
        </button>
        {error && <p className="text-xs text-amber">{error}</p>}
      </form>

      <div className="mt-4 flex justify-center gap-3 text-xs text-ink-muted">
        <a href="/api/auth/github" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/5">GitHub</a>
        <a href="/api/auth/google" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/5">Google</a>
      </div>
    </div>
  );
}
