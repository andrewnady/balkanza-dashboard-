"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMetrics, fmtInt } from "../../components/ui/primitives";

const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL_TEMPLATE || "https://balkanza.com/profile/{id}";
const profileUrl = (id: string) => PROFILE_URL.replace("{id}", encodeURIComponent(id));

const TITLES: Record<string, string> = {
  signups: "New sign-ups",
  active: "Active users",
  completed: "Completed profile",
  liked: "Sent a like",
  matched: "Got a match",
  messaged: "Sent a message",
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

const VERIF_BADGE: Record<string, string> = { approved: "good", rejected: "crit", pending: "warn", unverified: "" };

function UsersContent() {
  const sp = useSearchParams();
  const type = sp.get("type") && TITLES[sp.get("type") as string] ? (sp.get("type") as string) : "signups";
  const params: Record<string, string> = {};
  (["type", "days", "range", "from", "to"] as const).forEach((k) => {
    const v = sp.get(k);
    if (v) params[k] = v;
  });
  const { data, error, loading } = useMetrics<any>("users", params);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="Balkanza" width={32} height={30} />
            <span className="brand-word">Balkanza</span>
            <span className="brand-divider" />
            <span className="brand-sub">Users</span>
          </div>
          <a className="logout-link" href="/#overview">← Back to dashboard</a>
        </div>
      </header>

      <div className="app">
        <div className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">{TITLES[type]}</h2>
              <p className="section-desc">
                {data ? (
                  <>
                    {fmtInt(data.rows.length)}
                    {data.rows.length === 500 ? " (first 500)" : ""} user{data.rows.length === 1 ? "" : "s"} · window:{" "}
                    <strong>{data.period.label}</strong> · {type === "active" ? "sorted by last active" : "sorted by signup time"} · click a name to open the profile.
                  </>
                ) : (
                  "Loading…"
                )}
              </p>
            </div>
          </div>

          {error ? (
            <div className="callout crit"><span className="callout-icon">⚠️</span><div>{error}</div></div>
          ) : loading || !data ? (
            <div className="card"><p className="muted">Loading users…</p></div>
          ) : data.rows.length === 0 ? (
            <div className="card"><p className="muted">No users in this window.</p></div>
          ) : (
            <div className="card">
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Profile</th>
                      <th>Verification</th>
                      <th>Source</th>
                      <th>Signed up</th>
                      <th>Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((u: any) => (
                      <tr key={u.id}>
                        <td>
                          <a href={profileUrl(u.id)} target="_blank" rel="noreferrer" className="match-user">
                            <strong>{u.name || u.email || u.id}</strong> ↗
                            {u.name && u.email ? <span className="muted"> · {u.email}</span> : null}
                          </a>
                        </td>
                        <td>
                          <span className={`badge ${u.complete ? "good" : "warn"}`}>{u.complete ? "complete" : "incomplete"}</span>
                        </td>
                        <td>
                          <span className={`badge ${VERIF_BADGE[u.verification] || ""}`}>{u.verification}</span>
                        </td>
                        <td className="muted">{u.source}</td>
                        <td className="muted">{fmtWhen(u.createdAt)}</td>
                        <td className="muted">{fmtWhen(u.lastActiveAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="app"><p className="muted" style={{ padding: 24 }}>Loading…</p></div>}>
      <UsersContent />
    </Suspense>
  );
}
