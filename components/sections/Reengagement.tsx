"use client";

import { useMetrics, SectionHead, CardSkeleton, ErrorNote, StatTile, fmtInt, fmtPct } from "../ui/primitives";

export default function Reengagement() {
  const { data, error, loading } = useMetrics<any>("reengagement", {});

  return (
    <section className="section" id="reengagement">
      <SectionHead id="reengagement-h" title="Re-engagement & AI matchmaker" desc="Can you reach dormant users, and is the AI matchmaker working? Live snapshot." />

      {error ? (
        <ErrorNote msg={error} />
      ) : loading || !data ? (
        <div className="grid grid-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} height={110} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <StatTile label="Push reach" value={data.reach.reachPct} sub={`${fmtInt(data.reach.withToken)} of ${fmtInt(data.reach.totalUsers)} users have a token`} format="pct" />
            <StatTile label="Reachable active users" value={data.reach.activeWithToken} sub="active 30d w/ push token" format="int" />
            <StatTile label="Dormant & unreachable" value={data.reach.dormantUnreachable} sub="inactive 7d+, no push token" format="int" goodDirection="down" />
            <StatTile label="AI chat-initiation rate" value={data.ai.chatRate} sub={`${fmtInt(data.ai.chatInitiated)} of ${fmtInt(data.ai.total)} AI intros`} format="pct" />
          </div>

          {data.reach.reachPct < 25 && (
            <div className="callout crit" style={{ marginBottom: 16 }}>
              <span className="callout-icon">🔕</span>
              <div>
                <strong>You can barely reach your users.</strong> Only <strong>{fmtPct(data.reach.reachPct)}</strong> have a push token, and{" "}
                <strong>{fmtInt(data.reach.dormantUnreachable)}</strong> dormant users have none — so most churned users can&apos;t be
                re-engaged by push at all. Fixing token capture (especially iOS — see below) unlocks your cheapest retention lever.
              </div>
            </div>
          )}

          <div className="grid grid-2">
            <div className="card">
              <p className="card-title">Push tokens by platform</p>
              <p className="card-note">Which platforms actually register for notifications.</p>
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead><tr><th>Platform</th><th className="num">Users with token</th></tr></thead>
                  <tbody>
                    {data.reach.byPlatform.map((p: any) => (
                      <tr key={p.platform}>
                        <td style={{ fontWeight: 600, textTransform: "capitalize" }}>{p.platform}</td>
                        <td className="num">{fmtInt(p.users)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <p className="card-title">Stalled-match re-engagement emails</p>
              <p className="card-note">Triggered emails nudging users back to one-sided &amp; dead matches — send → open → click → convert.</p>
              {data.emails.total.sent === 0 ? (
                <div className="callout info" style={{ marginTop: 8 }}>
                  <span className="callout-icon">📭</span>
                  <div>No stalled-match emails have been sent yet. The system is configured (one-sided &amp; dead-match triggers) but hasn&apos;t fired — this panel fills in automatically once it starts sending.</div>
                </div>
              ) : (
                <div className="tbl-scroll">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Trigger</th>
                        <th className="num">Sent</th>
                        <th className="num">Opened</th>
                        <th className="num">Clicked</th>
                        <th className="num">Converted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.emails.byType.map((t: any) => (
                        <tr key={t.type}>
                          <td style={{ fontWeight: 600 }}>{t.label}</td>
                          <td className="num">{fmtInt(t.sent)}</td>
                          <td className="num">{fmtInt(t.opened)} <span className="muted">({fmtPct(t.openRate)})</span></td>
                          <td className="num">{fmtInt(t.clicked)} <span className="muted">({fmtPct(t.clickRate)})</span></td>
                          <td className="num">{fmtInt(t.converted)} <span className="muted">({fmtPct(t.convRate)})</span></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ fontWeight: 700, borderTop: "1px solid var(--border)" }}>Total</td>
                        <td className="num" style={{ fontWeight: 700, borderTop: "1px solid var(--border)" }}>{fmtInt(data.emails.total.sent)}</td>
                        <td className="num" style={{ borderTop: "1px solid var(--border)" }}>{fmtInt(data.emails.total.opened)} <span className="muted">({fmtPct(data.emails.total.openRate)})</span></td>
                        <td className="num" style={{ borderTop: "1px solid var(--border)" }}>{fmtInt(data.emails.total.clicked)} <span className="muted">({fmtPct(data.emails.total.clickRate)})</span></td>
                        <td className="num" style={{ borderTop: "1px solid var(--border)" }}>{fmtInt(data.emails.total.converted)} <span className="muted">({fmtPct(data.emails.total.convRate)})</span></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <p className="card-title">AI matchmaker performance</p>
              <p className="card-note">Are AI-suggested intros driving people to actually start chatting?</p>
              <div className="tbl-scroll">
                <table className="tbl">
                  <tbody>
                    <tr><td>AI intros generated</td><td className="num">{fmtInt(data.ai.total)}</td></tr>
                    <tr><td>Led to a chat</td><td className="num">{fmtInt(data.ai.chatInitiated)}</td></tr>
                    <tr><td>Chat-initiation rate</td><td className="num"><span className={`badge ${data.ai.chatRate >= 40 ? "good" : "warn"}`}>{fmtPct(data.ai.chatRate)}</span></td></tr>
                    <tr><td>Avg compatibility score</td><td className="num">{fmtInt(data.ai.avgScore)}</td></tr>
                    <tr><td>Feedback collected</td><td className="num">{data.ai.feedback === 0 ? <span className="badge warn">none</span> : fmtInt(data.ai.feedback)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
