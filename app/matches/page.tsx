"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMetrics, fmtInt } from "../../components/ui/primitives";

const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL_TEMPLATE || "https://balkanza.com/profile/{id}";
const profileUrl = (id: string) => PROFILE_URL.replace("{id}", encodeURIComponent(id));

const TITLES: Record<string, string> = {
  all: "All matches",
  talked: "Matches that talked",
  dead: "Dead matches — no message",
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function UserCell({ u }: { u: { id: string; name: string | null; email: string | null } }) {
  return (
    <a href={profileUrl(u.id)} target="_blank" rel="noreferrer" className="match-user">
      <strong>{u.name || u.email || u.id}</strong> ↗
      {u.name && u.email ? <span className="muted"> · {u.email}</span> : null}
    </a>
  );
}

function MatchesContent() {
  const sp = useSearchParams();
  const type = sp.get("type") || "all";
  const params: Record<string, string> = {};
  (["type", "days", "range", "from", "to"] as const).forEach((k) => {
    const v = sp.get(k);
    if (v) params[k] = v;
  });
  const { data, error, loading } = useMetrics<any>("matches", params);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="Balkanza" width={32} height={30} />
            <span className="brand-word">Balkanza</span>
            <span className="brand-divider" />
            <span className="brand-sub">Matches</span>
          </div>
          <a className="logout-link" href="/#engagement">← Back to dashboard</a>
        </div>
      </header>

      <div className="app">
        <div className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">{TITLES[type] || TITLES.all}</h2>
              <p className="section-desc">
                {data ? (
                  <>
                    {fmtInt(data.rows.length)} {data.rows.length === 500 ? "(showing first 500) " : ""}
                    match{data.rows.length === 1 ? "" : "es"} · window: <strong>{data.period.label}</strong> · click a name to open their profile.
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
            <div className="card"><p className="muted">Loading matches…</p></div>
          ) : data.rows.length === 0 ? (
            <div className="card"><p className="muted">No matches in this window.</p></div>
          ) : (
            <div className="card">
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>User A</th>
                      <th>User B</th>
                      <th className="num">Messages</th>
                      <th>Status</th>
                      <th>Matched</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r: any, i: number) => (
                      <tr key={i}>
                        <td><UserCell u={r.a} /></td>
                        <td><UserCell u={r.b} /></td>
                        <td className="num">{fmtInt(r.messages)}</td>
                        <td>
                          <span className={`badge ${r.talked ? "good" : "warn"}`}>{r.talked ? "talked" : "dead"}</span>
                        </td>
                        <td className="muted">{fmtWhen(r.matchedAt)}</td>
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

export default function MatchesPage() {
  return (
    <Suspense fallback={<div className="app"><p className="muted" style={{ padding: 24 }}>Loading…</p></div>}>
      <MatchesContent />
    </Suspense>
  );
}
