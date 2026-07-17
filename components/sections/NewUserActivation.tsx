"use client";

import { useMetrics, SectionHead, CardSkeleton, ErrorNote, StatTile, fmtInt, fmtPct } from "../ui/primitives";

function weekLabel(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export default function NewUserActivation() {
  const { data, error, loading } = useMetrics<any>("new-user-activation", {});
  const lm = data?.latestMature;

  return (
    <section className="section" id="new-user-activation">
      <SectionHead id="new-user-activation-h" title="New-user activation" desc="Are the new-user bets (New badge, auto-boost, activity-first ranking, Today's Best 10) getting newcomers matched faster? Track the before/after here." />

      {error ? (
        <ErrorNote msg={error} />
      ) : loading || !data ? (
        <div className="grid grid-4">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} height={110} />)}</div>
      ) : (
        <>
          <div className="grid grid-2" style={{ marginBottom: 16 }}>
            <StatTile label="New-user 7-day match rate" value={lm ? lm.matchRate : 0} sub={lm ? `latest complete cohort · ${weekLabel(lm.week)}` : "—"} format="pct" />
            <StatTile label="Median time to first match" value={lm ? lm.medianHrs : 0} sub="hours after signup (matched users)" format="int" goodDirection="down" />
          </div>

          <div className="card">
            <p className="card-title">Cohort detail</p>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Sign-up week</th>
                    <th className="num">New users</th>
                    <th className="num">Matched in 7d</th>
                    <th className="num">7-day match rate</th>
                    <th className="num">Median time to match</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.cohorts].reverse().map((c: any) => (
                    <tr key={c.week}>
                      <td style={{ fontWeight: 600 }}>{weekLabel(c.week)}</td>
                      <td className="num">{fmtInt(c.size)}</td>
                      <td className="num">{fmtInt(c.matched7d)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{fmtPct(c.matchRate)}</td>
                      <td className="num muted">{c.medianHrs ? `${fmtInt(c.medianHrs)}h` : "—"}</td>
                      <td>{c.mature ? <span className="badge good">complete</span> : <span className="badge warn">maturing</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
