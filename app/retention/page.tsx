"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMetrics, fmtInt, fmtPct, fmtAgo } from "../../components/ui/primitives";

const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL_TEMPLATE || "https://balkanza.com/profile/{id}";
const profileUrl = (id: string) => PROFILE_URL.replace("{id}", encodeURIComponent(id));

const SEG: Record<string, { title: string; desc: string }> = {
  retained: { title: "Retained users", desc: "active in the last 3 days" },
  churned: { title: "Churned users", desc: "were active, now gone" },
  ghost: { title: "Never-activated users", desc: "no activity after signup" },
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="signal-chip">
      <span className="signal-chip-n on">{value}</span>
      <span className="signal-chip-label">{label}</span>
    </div>
  );
}

function RetentionContent() {
  const sp = useSearchParams();
  const segment = sp.get("segment") && SEG[sp.get("segment") as string] ? (sp.get("segment") as string) : "churned";
  const { data, error, loading } = useMetrics<any>("retention", { segment });
  const meta = SEG[segment];

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="Balkanza" width={32} height={30} />
            <span className="brand-word">Balkanza</span>
            <span className="brand-divider" />
            <span className="brand-sub">Retention</span>
          </a>
          <a className="logout-link" href="/#diagnostics">← Back to dashboard</a>
        </div>
      </header>

      <div className="app">
        <div className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">{meta.title}</h2>
              <p className="section-desc">
                {data ? (
                  <>
                    {fmtInt(data.summary.n)} users · {meta.desc} · cohort registered 7–30 days ago ·{" "}
                    {data.rows.length < data.summary.n ? `showing first ${fmtInt(data.rows.length)} · ` : ""}click a name to open the profile.
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
          ) : (
            <>
              <div className="signal-chips" style={{ marginBottom: 16 }}>
                <Stat label="have a photo" value={fmtPct(data.summary.pctPhoto)} />
                <Stat label="profile complete" value={fmtPct(data.summary.pctComplete)} />
                <Stat label="heritage set" value={fmtPct(data.summary.pctHeritage)} />
                <Stat label="female" value={fmtPct(data.summary.pctFemale)} />
                <Stat label="male" value={fmtPct(data.summary.pctMale)} />
                <Stat label="avg likes sent" value={String(data.summary.avgLikesSent)} />
                <Stat label="avg likes received" value={String(data.summary.avgLikesReceived)} />
                <Stat label="avg messages sent" value={String(data.summary.avgMsgsSent)} />
              </div>

              {data.rows.length === 0 ? (
                <div className="card"><p className="muted">No users in this segment.</p></div>
              ) : (
                <div className="card">
                  <div className="tbl-scroll">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Gender</th>
                          <th>Photo</th>
                          <th>Residence</th>
                          <th>Heritage</th>
                          <th className="num">Likes sent</th>
                          <th className="num">Likes recv</th>
                          <th className="num">Msgs sent</th>
                          <th className="num">Msgs recv</th>
                          <th>Last active</th>
                          <th>Signed up</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((u: any) => (
                          <tr key={u.id}>
                            <td>
                              <a href={profileUrl(u.id)} target="_blank" rel="noreferrer" className="match-user">
                                <strong>{u.name || u.email || u.id}</strong> ↗
                                {u.email ? <div className="muted" style={{ fontSize: 12 }}>{u.email}</div> : null}
                              </a>
                            </td>
                            <td className="muted">{u.gender || "—"}</td>
                            <td><span className={`badge ${u.hasPhoto ? "good" : "crit"}`}>{u.hasPhoto ? "yes" : "no"}</span></td>
                            <td className="muted">{u.residence}</td>
                            <td className="muted">{u.heritage || "—"}</td>
                            <td className="num" style={{ fontWeight: 600 }}>{fmtInt(u.likesSent)}</td>
                            <td className="num">{fmtInt(u.likesReceived)}</td>
                            <td className="num" style={{ fontWeight: 600 }}>{fmtInt(u.msgsSent)}</td>
                            <td className="num">{fmtInt(u.msgsReceived)}</td>
                            <td className="muted" title={fmtWhen(u.lastActiveAt)}>{fmtAgo(u.lastActiveAt)}</td>
                            <td className="muted">{fmtWhen(u.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function RetentionPage() {
  return (
    <Suspense fallback={<div className="app"><p className="muted" style={{ padding: 24 }}>Loading…</p></div>}>
      <RetentionContent />
    </Suspense>
  );
}
