"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMetrics, fmtInt, fmtAgo } from "../../components/ui/primitives";

const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL_TEMPLATE || "https://balkanza.com/profile/{id}";
const profileUrl = (id: string) => PROFILE_URL.replace("{id}", encodeURIComponent(id));

const TITLES: Record<string, string> = {
  all: "All matches",
  twoway: "Two-way conversations",
  oneside: "One-sided matches — one messaged, no reply",
  dead: "Dead matches — no contact at all",
};

const STATUS_BADGE: Record<string, string> = { "two-way": "good", "one-sided": "warn", dead: "crit" };

const STATUS_FILTERS: [string, string][] = [
  ["all", "All"],
  ["twoway", "Two-way"],
  ["oneside", "One-sided"],
  ["dead", "Dead"],
];

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

const GENDER = (g: string | null): string => (g === "male" ? "♂" : g === "female" ? "♀" : "");

function UserCell({ u, sentFirst, matchedAt }: { u: { id: string; name: string | null; email: string | null; lastActive: string | null; gender: string | null }; sentFirst: boolean; matchedAt: string | null }) {
  const activeAfter = u.lastActive && matchedAt && new Date(u.lastActive) > new Date(matchedAt);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <a href={profileUrl(u.id)} target="_blank" rel="noreferrer" className="match-user">
        <strong>{u.name || u.email || u.id}</strong>{GENDER(u.gender) ? <span className="muted"> {GENDER(u.gender)}</span> : null} ↗
        {sentFirst ? <span className="badge good" style={{ marginLeft: 6 }}>✉ messaged first</span> : null}
      </a>
      <span className="muted" style={{ fontSize: 12 }} title={fmtWhen(u.lastActive)}>
        active {fmtAgo(u.lastActive)}{activeAfter ? " · seen since match" : ""}
      </span>
    </div>
  );
}

function MatchesContent() {
  const sp = useSearchParams();
  const type = sp.get("type") || "all";
  const params: Record<string, string> = {};
  (["type", "days", "range", "from", "to", "asof"] as const).forEach((k) => {
    const v = sp.get(k);
    if (v) params[k] = v;
  });
  const { data, error, loading } = useMetrics<any>("matches", params);

  // Preserve the current window params (days/asof/etc.) when switching status.
  const windowQs = (["days", "range", "from", "to", "asof"] as const)
    .map((k) => (sp.get(k) ? `${k}=${encodeURIComponent(sp.get(k) as string)}` : ""))
    .filter(Boolean)
    .join("&");
  const hrefFor = (t: string) => `/matches?type=${t}${windowQs ? `&${windowQs}` : ""}`;

  // Why are dead matches dead? Split into "both came back but nobody wrote"
  // (a product/prompting problem) vs "someone never returned" (churn).
  const seenSince = (u: any, matchedAt: string | null) => u.lastActive && matchedAt && new Date(u.lastActive) > new Date(matchedAt);
  let deadInsight: { total: number; bothSeen: number; oneGone: number; bothGone: number } | null = null;
  if (data && data.rows.length && type === "dead") {
    let bothSeen = 0, oneGone = 0, bothGone = 0;
    for (const r of data.rows) {
      const a = seenSince(r.a, r.matchedAt), b = seenSince(r.b, r.matchedAt);
      if (a && b) bothSeen++; else if (!a && !b) bothGone++; else oneGone++;
    }
    deadInsight = { total: data.rows.length, bothSeen, oneGone, bothGone };
  }

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="Balkanza" width={32} height={30} />
            <span className="brand-word">Balkanza</span>
            <span className="brand-divider" />
            <span className="brand-sub">Matches</span>
          </a>
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
            <div className="filters">
              <span className="filter-label">Status</span>
              <div className="segmented">
                {STATUS_FILTERS.map(([t, label]) => (
                  <button key={t} className={type === t ? "active" : ""} onClick={() => { window.location.href = hrefFor(t); }}>
                    {label}
                  </button>
                ))}
              </div>
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
              {deadInsight && (
                <div className="callout info" style={{ marginBottom: 14 }}>
                  <span className="callout-icon">🔍</span>
                  <div>
                    <strong>Why these are dead:</strong> of {deadInsight.total} dead matches,{" "}
                    <strong>{deadInsight.bothSeen}</strong> had <strong>both people back on the app after matching</strong> yet no one wrote
                    (a nudge / icebreaker problem), <strong>{deadInsight.oneGone}</strong> had one side never return, and{" "}
                    <strong>{deadInsight.bothGone}</strong> had neither return (pure churn). &ldquo;seen since match&rdquo; is flagged under each name.
                  </div>
                </div>
              )}
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
                        <td><UserCell u={r.a} sentFirst={r.firstSender === r.a.id} matchedAt={r.matchedAt} /></td>
                        <td><UserCell u={r.b} sentFirst={r.firstSender === r.b.id} matchedAt={r.matchedAt} /></td>
                        <td className="num">{fmtInt(r.messages)}</td>
                        <td>
                          <span className={`badge ${STATUS_BADGE[r.status] || "warn"}`}>{r.status}</span>
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
