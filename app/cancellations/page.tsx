"use client";

import { Suspense, useMemo, useState } from "react";
import { useMetrics, fmtInt, fmtMoney, fmtAgo } from "../../components/ui/primitives";

const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL_TEMPLATE || "https://balkanza.com/profile/{id}";
const profileUrl = (id: string) => PROFILE_URL.replace("{id}", encodeURIComponent(id));

type Period = { days?: number; range?: "all"; from?: string; to?: string };

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86400_000).toISOString().slice(0, 10);
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

const SCOPES = [
  { value: "paid", label: "Paid churn", desc: "Ended paid subscriptions (had ≥1 real payment)" },
  { value: "canceled", label: "Canceled only", desc: "Explicitly canceled by the user" },
  { value: "all", label: "All ended", desc: "Every canceled + expired sub (incl. free-plan lapses)" },
] as const;

function CancellationsContent() {
  const [period, setPeriod] = useState<Period>({ range: "all" });
  const [scope, setScope] = useState<"paid" | "canceled" | "all">("paid");
  const [showCustom, setShowCustom] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = useMemo(() => {
    const q: Record<string, string> = { scope };
    if (period.range === "all") q.range = "all";
    else if (period.from && period.to) { q.from = period.from; q.to = period.to; }
    else q.days = String(period.days ?? 30);
    return q;
  }, [period, scope]);

  const { data, error, loading } = useMetrics<any>("cancellations", params);

  const yesterday = isoDaysAgo(1);
  const isActive = (p: Period) =>
    (p.range === "all" && period.range === "all") ||
    (p.days !== undefined && period.days === p.days && !period.range && !period.from) ||
    (p.from !== undefined && period.from === p.from && period.to === p.to);

  const presets: { label: string; p: Period }[] = [
    { label: "Today", p: { days: 1 } },
    { label: "Yesterday", p: { from: yesterday, to: yesterday } },
    { label: "7 days", p: { days: 7 } },
    { label: "30 days", p: { days: 30 } },
    { label: "All time", p: { range: "all" } },
  ];

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="Balkanza" width={32} height={30} />
            <span className="brand-word">Balkanza</span>
            <span className="brand-divider" />
            <span className="brand-sub">Cancellations</span>
          </a>
          <a className="logout-link" href="/#monetization">← Back to dashboard</a>
        </div>
      </header>

      <div className="app">
        <div className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">Canceled subscriptions</h2>
              <p className="section-desc">
                {data ? (
                  <>
                    {fmtInt(data.totals.users)}{data.rows.length === 500 ? " (top 500)" : ""} churned subscriber{data.totals.users === 1 ? "" : "s"} ·{" "}
                    <strong>{fmtMoney(data.totals.revenue)}</strong> lifetime revenue · {fmtInt(data.totals.renewed)} renewed at least once · window:{" "}
                    <strong>{data.period.label}</strong> · filtered by churn date · click a name to open the profile.
                  </>
                ) : (
                  "Loading…"
                )}
              </p>
            </div>
          </div>

          <div className="filters" style={{ marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
            <div className="segmented">
              {presets.map((pr) => (
                <button
                  key={pr.label}
                  className={isActive(pr.p) && !showCustom ? "active" : ""}
                  onClick={() => { setShowCustom(false); setPeriod(pr.p); }}
                >
                  {pr.label}
                </button>
              ))}
              <button className={showCustom ? "active" : ""} onClick={() => setShowCustom((o) => !o)}>Custom</button>
            </div>
            <span className="filter-label" style={{ marginLeft: 8 }}>Population</span>
            <div className="segmented">
              {SCOPES.map((s) => (
                <button key={s.value} className={scope === s.value ? "active" : ""} title={s.desc} onClick={() => setScope(s.value)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {showCustom && (
            <div className="daterange" style={{ marginBottom: 14 }}>
              <input type="date" aria-label="From" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              <span className="muted">→</span>
              <input type="date" aria-label="To" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
              <button className="apply" disabled={!from || !to || from > to} onClick={() => setPeriod({ from, to })}>Apply</button>
            </div>
          )}

          {error ? (
            <div className="callout crit"><span className="callout-icon">⚠️</span><div>{error}</div></div>
          ) : loading || !data ? (
            <div className="card"><p className="muted">Loading cancellations…</p></div>
          ) : data.rows.length === 0 ? (
            <div className="card"><p className="muted">No canceled subscriptions in this window for the selected population.</p></div>
          ) : (
            <div className="card">
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Gender</th>
                      <th>Plan</th>
                      <th>Status</th>
                      <th className="num">Amount</th>
                      <th>Started</th>
                      <th>Churned</th>
                      <th>Renewed?</th>
                      <th>Paid months</th>
                      <th>Cancel reason</th>
                      <th className="num">Matches</th>
                      <th className="num">Likes</th>
                      <th className="num">Dislikes</th>
                      <th className="num">Super likes</th>
                      <th className="num">Roses</th>
                      <th className="num">Boosts</th>
                      <th className="num">Messages</th>
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
                        <td className="muted">{u.gender}</td>
                        <td>{u.planName}</td>
                        <td>
                          <span className={`badge ${u.status === "canceled" ? "warn" : ""}`}>{u.status}</span>
                        </td>
                        <td className="num">{fmtMoney(u.amount)}</td>
                        <td className="muted" title={fmtWhen(u.startedAt)}>{fmtDate(u.startedAt)}</td>
                        <td className="muted" title={fmtWhen(u.endedAt)}>{fmtDate(u.endedAt)}</td>
                        <td>
                          {u.renewed
                            ? <span className="badge good">Yes · {fmtInt(u.payments)}×</span>
                            : <span className="muted">No{u.payments ? ` · ${fmtInt(u.payments)}×` : ""}</span>}
                        </td>
                        <td className="muted">{u.payMonths}</td>
                        <td className="muted">{u.cancelReason || "—"}</td>
                        <td className="num">{fmtInt(u.matches)}</td>
                        <td className="num">{fmtInt(u.likesSent)}</td>
                        <td className="num">{fmtInt(u.dislikesSent)}</td>
                        <td className="num">{fmtInt(u.superLikes)}</td>
                        <td className="num">{fmtInt(u.rosesSent)}</td>
                        <td className="num">{fmtInt(u.boosts)}</td>
                        <td className="num">{fmtInt(u.msgsSent)}</td>
                        <td className="muted" title={fmtWhen(u.lastActive)}>{fmtAgo(u.lastActive)}</td>
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

export default function CancellationsPage() {
  return (
    <Suspense fallback={<div className="app"><p className="muted" style={{ padding: 24 }}>Loading…</p></div>}>
      <CancellationsContent />
    </Suspense>
  );
}
