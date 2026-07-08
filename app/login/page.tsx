"use client";

import { useState } from "react";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const params = new URLSearchParams(window.location.search);
        window.location.href = params.get("next") || "/";
        return;
      }
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Login failed.");
    } catch {
      setError("Network error — try again.");
    }
    setBusy(false);
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <svg className="brand-logo" viewBox="0 0 32 32" role="img" aria-label="Balkanza" width={34} height={34}>
            <defs>
              <linearGradient id="blk-login" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--brand-from)" />
                <stop offset="1" stopColor="var(--brand-to)" />
              </linearGradient>
            </defs>
            <path
              fill="url(#blk-login)"
              d="M16 29S3 21.2 3 12.1C3 7.6 6.4 4 10.6 4c2.6 0 4.6 1.3 5.4 3.2C17.3 5.6 19.3 4 22 4c3.7 0 7 3 7 7.5 0 9-13 16.5-13 16.5z"
            />
            <path
              fill="#fff"
              opacity="0.92"
              d="M13.6 10.4c2.6 0 4.2 1.3 4.2 3.4 0 1.3-.7 2.3-1.9 2.7 1.5.3 2.4 1.4 2.4 2.9 0 2.2-1.7 3.5-4.5 3.5h-4.2V10.4h4zM12 14.9h1.3c1 0 1.6-.5 1.6-1.4 0-.8-.6-1.3-1.6-1.3H12v2.7zm0 5h1.5c1.1 0 1.7-.5 1.7-1.5 0-.9-.6-1.4-1.8-1.4H12v2.9z"
            />
          </svg>
          <span className="brand-word">Balkanza</span>
        </div>
        <p className="login-title">Product Dashboard</p>
        <p className="login-note">This dashboard is private. Enter the access password to continue.</p>

        <input
          type="password"
          className="login-input"
          placeholder="Access password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
        />
        {error && <p className="login-error">{error}</p>}
        <button className="login-btn" type="submit" disabled={busy || !password}>
          {busy ? "Checking…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
