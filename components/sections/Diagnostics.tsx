"use client";

import { useMetrics, SectionHead, CardSkeleton, ErrorNote, fmtInt, fmtPct } from "../ui/primitives";
import { HBars } from "../ui/charts";

function humanH(h: number): string {
  if (!h || h < 0) return "—";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h % 1 === 0 ? h : h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} days`;
}

const SEG = [
  { key: "retained", label: "Retained", note: "active in last 3 days", color: "var(--series-4)" },
  { key: "churned", label: "Churned", note: "was active, now gone", color: "var(--series-3)" },
  { key: "ghost", label: "Never activated", note: "no activity after signup", color: "var(--series-6)" },
];

export default function Diagnostics() {
  const { data, error, loading } = useMetrics<any>("diagnostics", {});

  return (
    <section className="section" id="diagnostics">
      <SectionHead
        id="diagnostics-h"
        title="Engagement diagnostics"
        desc="The leaky-bucket analysis — what makes users stay vs. leave. Structural view across all users (not affected by the time filters)."
      />

      {error ? (
        <ErrorNote msg={error} />
      ) : loading || !data ? (
        <div className="grid grid-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} height={220} />
          ))}
        </div>
      ) : (
        <>
          {(() => {
            const r = data.retention;
            const lift = r.churned.matched > 0 ? r.retained.matched / r.churned.matched : 0;
            const retPct = r.cohortN ? (100 * r.retained.n) / r.cohortN : 0;
            return (
              <div className="callout info" style={{ marginBottom: 16 }}>
                <span className="callout-icon">💡</span>
                <div>
                  <strong>Day-1 match is the retention lever.</strong> Only {fmtPct(retPct)} of a mature cohort is still active — but
                  users who got a match on day one retain <strong>{lift.toFixed(1)}×</strong> better than those who didn&apos;t. Meanwhile the
                  median user takes <strong>{humanH(data.timeToValue.matchH)}</strong> to first match — far past the day-1 window that predicts retention.
                </div>
              </div>
            );
          })()}

          {/* Retention root cause */}
          <div className="card" style={{ marginBottom: 16 }}>
            <p className="card-title">Retention root cause · day-1 behaviour of stayers vs. leavers</p>
            <p className="card-note">Cohort registered 7–30 days ago (n={fmtInt(data.retention.cohortN)}). What the retained did differently on day one.</p>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Segment</th>
                    <th className="num">Users</th>
                    <th className="num">Matched day 1</th>
                    <th className="num">Messaged day 1</th>
                    <th className="num">Liked day 1</th>
                    <th className="num">Completed profile</th>
                  </tr>
                </thead>
                <tbody>
                  {SEG.map((s) => {
                    const row = data.retention[s.key];
                    return (
                      <tr key={s.key} className="row-link" onClick={() => { window.location.href = `/retention?segment=${s.key}`; }}>
                        <td style={{ fontWeight: 600 }}>
                          <span className="dot" style={{ background: s.color }} />
                          <span className="row-link-name">{s.label} ↗</span> <span className="muted" style={{ fontWeight: 400 }}>· {s.note}</span>
                        </td>
                        <td className="num">{fmtInt(row.n)}</td>
                        <td className="num" style={{ fontWeight: 700, color: s.key === "retained" ? "var(--good-text)" : undefined }}>{fmtPct(row.matched)}</td>
                        <td className="num" style={{ fontWeight: 600 }}>{fmtPct(row.messaged)}</td>
                        <td className="num muted">{fmtPct(row.liked)}</td>
                        <td className="num muted">{fmtPct(row.complete)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-3">
            {/* Time to value */}
            <div className="card">
              <p className="card-title">Time to first…</p>
              <p className="card-note">Median from signup. Liking is instant; matching is the bottleneck.</p>
              <div className="ttv-rows">
                {[
                  { label: "First like", h: data.timeToValue.likeH, ever: data.timeToValue.everLiked },
                  { label: "First match", h: data.timeToValue.matchH, ever: data.timeToValue.everMatched },
                  { label: "First message", h: data.timeToValue.msgH, ever: data.timeToValue.everMessaged },
                ].map((x) => (
                  <div key={x.label} className="ttv-row">
                    <span className="ttv-label">{x.label}</span>
                    <span className="ttv-val">{humanH(x.h)}</span>
                    <span className="ttv-ever muted">{fmtPct(data.timeToValue.total ? (100 * x.ever) / data.timeToValue.total : 0)} ever</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dead matches */}
            <div className="card">
              <p className="card-title">Where matches die</p>
              <p className="card-note">
                {fmtPct(data.deadMatches.total ? (100 * (data.deadMatches.neither + data.deadMatches.oneSided)) / data.deadMatches.total : 0)} of {fmtInt(data.deadMatches.total)} matches never become a conversation.
              </p>
              <HBars
                data={[
                  { label: "Neither messaged", value: data.deadMatches.neither },
                  { label: "One-sided (no reply)", value: data.deadMatches.oneSided },
                  { label: "Both messaged (alive)", value: data.deadMatches.alive },
                ]}
                labelKey="label"
                valueKey="value"
                colors={["var(--series-6)", "var(--series-3)", "var(--series-4)"]}
                valueFmt={fmtInt}
              />
              <p className="card-note" style={{ marginTop: 8 }}>
                The biggest slice is <strong>neither side messaging</strong> — an activation gap that in-app icebreakers directly target.
              </p>
            </div>

            {/* Push reach */}
            <div className="card">
              <p className="card-title">Re-engagement reach</p>
              <p className="card-note">Push notifications can only reach users who granted a token.</p>
              <div className="tile-value" style={{ fontSize: 44, marginTop: 8 }}>
                {fmtPct(data.pushReach.users ? (100 * data.pushReach.tokens) / data.pushReach.users : 0)}
              </div>
              <p className="tile-sub">{fmtInt(data.pushReach.tokens)} of {fmtInt(data.pushReach.users)} users reachable by push</p>
              <p className="card-note" style={{ marginTop: 10 }}>
                The notification pipeline is live, but reach is the cap — driving push opt-in is the cheapest retention win available.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
