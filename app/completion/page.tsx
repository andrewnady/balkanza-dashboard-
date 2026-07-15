"use client";

import { Suspense, useState } from "react";
import { useMetrics, StatTile, fmtInt, fmtPct, fmtAgo } from "../../components/ui/primitives";
import { HBars } from "../../components/ui/charts";

const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL_TEMPLATE || "https://balkanza.com/profile/{id}";
const profileUrl = (id: string) => PROFILE_URL.replace("{id}", encodeURIComponent(id));

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function Insights() {
  const { data, error, loading } = useMetrics<any>("completion-insights", {});
  const [step, setStep] = useState<string>("all");
  const list = useMetrics<any>("incomplete-users", step === "all" ? {} : { step });

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="Balkanza" width={32} height={30} />
            <span className="brand-word">Balkanza</span>
            <span className="brand-divider" />
            <span className="brand-sub">Profile completion</span>
          </a>
          <a className="logout-link" href="/#funnel">← Back to dashboard</a>
        </div>
      </header>

      <div className="app">
        <div className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">Why aren&apos;t profiles completing?</h2>
              <p className="section-desc">
                Onboarding drop-off, which questions get skipped, and the incomplete users behind it. Whole base (live).
              </p>
            </div>
          </div>

          {error ? (
            <div className="callout crit"><span className="callout-icon">⚠️</span><div>{error}</div></div>
          ) : loading || !data ? (
            <div className="card"><p className="muted">Loading insights…</p></div>
          ) : (
            <>
              <div className="grid grid-4" style={{ marginBottom: 16 }}>
                <StatTile label="Completion rate" value={data.totals.completionPct} sub={`${fmtInt(data.totals.complete)} of ${fmtInt(data.totals.total)} profiles`} format="pct" />
                <StatTile label="Incomplete profiles" value={data.totals.incomplete} sub={`${fmtPct(data.totals.incompletePct)} of all profiles`} format="int" goodDirection="down" />
                <StatTile label="Abandoned (>7 days old)" value={data.totals.abandoned} sub={`${fmtInt(data.totals.recent)} still recent (≤7d)`} format="int" goodDirection="down" />
                <StatTile label="Avg fields answered" value={data.totals.avgFields} sub={`of ${data.totals.totalFields} onboarding fields`} format="int" />
              </div>

              <div className="callout crit" style={{ marginBottom: 16 }}>
                <span className="callout-icon">🎯</span>
                <div>
                  <strong>The drop-off is front-loaded.</strong> Most incomplete users stall on the very first onboarding step and never pick
                  gender / interested-in — see the step chart below. Fixing step 1 (fewer/optional fields, clearer progress, a save-and-resume nudge)
                  is the highest-leverage change.
                </div>
              </div>

              <div className="grid grid-2">
                <div className="card">
                  <p className="card-title">Where they stop — onboarding step</p>
                  <p className="card-note">Incomplete profiles by the step they reached (step 7 = finished). Click a bar to list those users.</p>
                  <HBars
                    data={data.steps.filter((s: any) => s.incomplete > 0).map((s: any) => ({ label: `Step ${s.step}`, users: s.incomplete, step: s.step }))}
                    labelKey="label"
                    valueKey="users"
                    colors={data.steps.filter((s: any) => s.incomplete > 0).map(() => "var(--series-3)")}
                    valueFmt={fmtInt}
                    onBarClick={(row: any) => { if (row?.step != null) setStep(String(row.step)); }}
                  />
                </div>
                <div className="card">
                  <p className="card-title">Which questions get answered</p>
                  <p className="card-note">% of incomplete profiles that filled each field, in onboarding order — the cliff is where they quit.</p>
                  <HBars
                    data={data.fieldFunnel.map((f: any) => ({ label: f.label, pct: f.pct }))}
                    labelKey="label"
                    valueKey="pct"
                    colors={data.fieldFunnel.map((f: any) => (f.pct >= 50 ? "var(--series-4)" : f.pct >= 15 ? "var(--series-1)" : "var(--series-6)"))}
                    valueFmt={fmtPct}
                    height={data.fieldFunnel.length * 30 + 20}
                  />
                </div>
              </div>

              <div className="card" style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <p className="card-title">Incomplete users {step !== "all" ? `· step ${step}` : ""}</p>
                    <p className="card-note">
                      {list.data ? `${fmtInt(list.data.rows.length)}${list.data.rows.length === 500 ? " (top 500)" : ""} shown` : "Loading…"} · click a name to open the profile.
                    </p>
                  </div>
                  <div className="segmented">
                    {["all", "1", "2", "3", "4", "5", "6", "7"].map((s) => (
                      <button key={s} className={step === s ? "active" : ""} onClick={() => setStep(s)}>
                        {s === "all" ? "All steps" : `Step ${s}`}
                      </button>
                    ))}
                  </div>
                </div>

                {list.error ? (
                  <div className="callout crit"><span className="callout-icon">⚠️</span><div>{list.error}</div></div>
                ) : list.loading || !list.data ? (
                  <p className="muted" style={{ fontSize: 13 }}>Loading users…</p>
                ) : list.data.rows.length === 0 ? (
                  <p className="muted" style={{ fontSize: 13 }}>No incomplete users at this step.</p>
                ) : (
                  <div className="tbl-scroll" style={{ marginTop: 10 }}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>User</th>
                          <th className="num">Step</th>
                          <th className="num">Fields answered</th>
                          <th>Photo</th>
                          <th>Gender</th>
                          <th>Date of birth</th>
                          <th>Heritage</th>
                          <th>Residence</th>
                          <th>Last active</th>
                          <th>Signed up</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.data.rows.map((u: any) => (
                          <tr key={u.id}>
                            <td>
                              <a href={profileUrl(u.id)} target="_blank" rel="noreferrer" className="match-user">
                                <strong>{u.name || u.email || u.id}</strong> ↗
                                {u.name && u.email ? <span className="muted"> · {u.email}</span> : null}
                              </a>
                            </td>
                            <td className="num">{u.currentStep}</td>
                            <td className="num">{u.answered} <span className="muted">/ {list.data.totalFields}</span></td>
                            <td>{u.hasPhoto ? <span className="badge good">Yes</span> : <span className="badge crit">No</span>}</td>
                            <td className="muted">{u.gender}</td>
                            <td className="muted">{u.birthdate || "—"}</td>
                            <td className="muted">{u.heritage}</td>
                            <td className="muted">{u.residence}</td>
                            <td className="muted" title={fmtWhen(u.lastActive)}>{fmtAgo(u.lastActive)}</td>
                            <td className="muted" title={fmtWhen(u.createdAt)}>{fmtDate(u.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function CompletionPage() {
  return (
    <Suspense fallback={<div className="app"><p className="muted" style={{ padding: 24 }}>Loading…</p></div>}>
      <Insights />
    </Suspense>
  );
}
