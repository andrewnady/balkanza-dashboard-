"use client";

import { useState } from "react";
import { useMetrics, fmtInt } from "../../components/ui/primitives";

const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL_TEMPLATE || "https://balkanza.com/profile/{id}";
const profileUrl = (id: string) => PROFILE_URL.replace("{id}", encodeURIComponent(id));

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="refresh-btn"
      style={{ padding: "5px 10px", fontSize: 12 }}
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1200);
        });
      }}
    >
      {done ? "Copied ✓" : "Copy"}
    </button>
  );
}

function Person({ p }: { p: any }) {
  return (
    <a href={profileUrl(p.id)} target="_blank" rel="noreferrer" className="match-user">
      <strong>{p.name || p.id}</strong> ↗
      <span className="muted"> · {p.heritageLabel}{p.residence && p.residence !== "—" ? ` · lives ${p.residence}` : ""}</span>
    </a>
  );
}

export default function IcebreakersPage() {
  const { data, error, loading } = useMetrics<any>("icebreakers", {});

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="Balkanza" width={32} height={30} />
            <span className="brand-word">Balkanza</span>
            <span className="brand-divider" />
            <span className="brand-sub">Icebreaker test</span>
          </a>
          <a className="logout-link" href="/#diagnostics">← Back to dashboard</a>
        </div>
      </header>

      <div className="app">
        <div className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">AI icebreaker preview — 100 real matches</h2>
              <p className="section-desc">
                Generated heritage-first openers for <strong>dead / one-sided matches</strong> (the ones that need help). Rule-based preview off
                real profile data — judge the quality here before wiring a live model. Names link to profiles.
              </p>
            </div>
          </div>

          <div className="callout info" style={{ marginBottom: 16 }}>
            <span className="callout-icon">💡</span>
            <div>
              These are suggested first messages to seed a stalled match. If they read well, the next step is A/B testing them on live matches and
              watching the <strong>two-way conversation rate</strong>. Swap the generator for an LLM once the concept proves out.
            </div>
          </div>

          {error ? (
            <div className="callout crit"><span className="callout-icon">⚠️</span><div>{error}</div></div>
          ) : loading || !data ? (
            <div className="card"><p className="muted">Generating icebreakers…</p></div>
          ) : (
            <>
              <p className="card-note" style={{ marginBottom: 10 }}>{fmtInt(data.rows.length)} matches</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.rows.map((r: any, i: number) => (
                  <div className="card" key={i} style={{ padding: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                      <div style={{ fontSize: 13 }}>
                        <Person p={r.a} /> <span className="muted">↔</span> <Person p={r.b} />
                      </div>
                      <span className={`badge ${r.status === "one-sided" ? "warn" : "crit"}`}>{r.status}</span>
                    </div>
                    <div className="icebreaker-box">
                      <span className="icebreaker-text">“{r.icebreaker}”</span>
                      <CopyBtn text={r.icebreaker} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
