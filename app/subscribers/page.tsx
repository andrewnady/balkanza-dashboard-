"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMetrics, fmtInt, fmtMoney } from "../../components/ui/primitives";

const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL_TEMPLATE || "https://balkanza.com/profile/{id}";
const profileUrl = (id: string) => PROFILE_URL.replace("{id}", encodeURIComponent(id));

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function SubscribersContent() {
  const sp = useSearchParams();
  const params: Record<string, string> = {};
  (["name", "price", "duration"] as const).forEach((k) => {
    const v = sp.get(k);
    if (v !== null) params[k] = v;
  });
  const { data, error, loading } = useMetrics<any>("subscribers", params);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="Balkanza" width={32} height={30} />
            <span className="brand-word">Balkanza</span>
            <span className="brand-divider" />
            <span className="brand-sub">Subscribers</span>
          </div>
          <a className="logout-link" href="/#monetization">← Back to dashboard</a>
        </div>
      </header>

      <div className="app">
        <div className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">
                {data ? `${data.plan.name} · ${fmtMoney(data.plan.price)} ${data.plan.duration}` : "Subscribers"}
              </h2>
              <p className="section-desc">
                {data ? (
                  <>
                    {fmtInt(data.rows.length)} active subscriber{data.rows.length === 1 ? "" : "s"} on this plan · click a name to open the profile.
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
            <div className="card"><p className="muted">Loading subscribers…</p></div>
          ) : data.rows.length === 0 ? (
            <div className="card"><p className="muted">No active subscribers on this plan.</p></div>
          ) : (
            <div className="card">
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Subscriber</th>
                      <th>Subscribed</th>
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
                        <td className="muted">{fmtWhen(u.subscribedAt)}</td>
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

export default function SubscribersPage() {
  return (
    <Suspense fallback={<div className="app"><p className="muted" style={{ padding: 24 }}>Loading…</p></div>}>
      <SubscribersContent />
    </Suspense>
  );
}
