"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMetrics, fmtInt, fmtMoney, fmtAgo } from "../../components/ui/primitives";

const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL_TEMPLATE || "https://balkanza.com/profile/{id}";
const profileUrl = (id: string) => PROFILE_URL.replace("{id}", encodeURIComponent(id));

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function BuyersContent() {
  const sp = useSearchParams();
  const type = sp.get("type") || "all";
  const params: Record<string, string> = {};
  (["type", "days", "range", "from", "to", "asof"] as const).forEach((k) => {
    const v = sp.get(k);
    if (v) params[k] = v;
  });
  const { data, error, loading } = useMetrics<any>("buyers", params);
  const totalRevenue = data ? data.rows.reduce((a: number, r: any) => a + r.total, 0) : 0;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="Balkanza" width={32} height={30} />
            <span className="brand-word">Balkanza</span>
            <span className="brand-divider" />
            <span className="brand-sub">Buyers</span>
          </a>
          <a className="logout-link" href="/#monetization">← Back to dashboard</a>
        </div>
      </header>

      <div className="app">
        <div className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">{type === "all" ? "All paying users" : `${type} — buyers`}</h2>
              <p className="section-desc">
                {data ? (
                  <>
                    {fmtInt(data.rows.length)}{data.rows.length === 500 ? " (top 500)" : ""} paying user{data.rows.length === 1 ? "" : "s"} ·{" "}
                    <strong>{fmtMoney(totalRevenue)}</strong> · window: <strong>{data.period.label}</strong> · sorted by spend · click a name to open the profile.
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
            <div className="card"><p className="muted">Loading buyers…</p></div>
          ) : data.rows.length === 0 ? (
            <div className="card"><p className="muted">No paid transactions in this window.</p></div>
          ) : (
            <div className="card">
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Bought</th>
                      <th className="num">Transactions</th>
                      <th className="num">Total spent</th>
                      <th>Last purchase</th>
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
                        <td className="muted">{u.types}</td>
                        <td className="num">{fmtInt(u.txns)}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{fmtMoney(u.total)}</td>
                        <td className="muted" title={fmtWhen(u.lastAt)}>{fmtAgo(u.lastAt)}</td>
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

export default function BuyersPage() {
  return (
    <Suspense fallback={<div className="app"><p className="muted" style={{ padding: 24 }}>Loading…</p></div>}>
      <BuyersContent />
    </Suspense>
  );
}
