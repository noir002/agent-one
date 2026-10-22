import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";

export default function DevLogin({ onLoggedIn }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("learner");
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
    <div className="mx-auto max-w-sm py-16">
      <h1 className="font-serif text-2xl font-semibold">Sign in</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Dev-mode login for the prototype — no password. Google sign-in replaces this once configured.
      </p>
      <form onSubmit={handleSubmit} className="card mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-border-pill px-3 py-2 text-sm outline-none focus:border-emerald"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">I am a…</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full rounded-lg border border-border-pill px-3 py-2 text-sm outline-none focus:border-emerald"
          >
            <option value="learner">Learner</option>
            <option value="builder">Builder</option>
          </select>
        </div>
        <button type="submit" className="btn-primary w-full">Sign in</button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
    </div>
  );
}
