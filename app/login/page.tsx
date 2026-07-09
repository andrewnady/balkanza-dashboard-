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
        // replace() so /login is not left in history (Back shouldn't return here).
        window.location.replace(params.get("next") || "/");
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo.svg" alt="Balkanza" width={34} height={32} />
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
