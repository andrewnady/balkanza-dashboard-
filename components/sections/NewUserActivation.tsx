"use client";

import { useMetrics, SectionHead, CardSkeleton, ErrorNote, StatTile, fmtInt, fmtPct } from "../ui/primitives";
import { GroupedBars } from "../ui/charts";

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
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <StatTile label="New-user 7-day match rate" value={lm ? lm.matchRate : 0} sub={lm ? `latest complete cohort · ${weekLabel(lm.week)}` : "—"} format="pct" />
            <StatTile label="Median time to first match" value={lm ? lm.medianHrs : 0} sub="hours after signup (matched users)" format="int" goodDirection="down" />
            <StatTile label="Auto-boost coverage" value={lm ? lm.boostRate : 0} sub={`${fmtInt(data.boostCoverage)} new users boosted in 72h`} format="pct" />
            <StatTile label="Likes to active users" value={data.freshness.toActive24h} sub={`recipients active <24h · ${fmtPct(data.freshness.toActive7d)} <7d`} format="pct" />
          </div>

          {data.boostCoverage <= 2 && (
            <div className="callout warn" style={{ marginBottom: 16 }}>
              <span className="callout-icon">⚠️</span>
              <div>
                <strong>Auto-boost isn&apos;t firing yet.</strong> Almost no new users received a boost within 72h of signing up
                ({fmtInt(data.boostCoverage)} across the last 8 weeks). Before judging its impact, confirm the auto-boost job is actually
                running in production and writing to <code>profile_boosts</code> — this number should jump to near 100% once it is.
              </div>
            </div>
          )}

          <div className="card">
            <p className="card-title">Weekly new-user cohorts — match rate vs. auto-boost coverage</p>
            <p className="card-note">
              Watch the 7-day match rate climb after the features launched. Faded bars are cohorts younger than 14 days (still maturing, so their 7-day number is incomplete).
            </p>
            <GroupedBars
              data={data.cohorts.map((c: any) => ({ label: weekLabel(c.week) + (c.mature ? "" : " *"), matchRate: c.matchRate, boostRate: c.boostRate }))}
              labelKey="label"
              series={[
                { key: "matchRate", name: "7-day match rate %", color: "#2563eb" },
                { key: "boostRate", name: "Auto-boost coverage %", color: "#7c4dff" },
              ]}
              height={280}
            />
            <div className="legend">
              <span><span className="dot" style={{ background: "#2563eb" }} />7-day match rate %</span>
              <span><span className="dot" style={{ background: "#7c4dff" }} />Auto-boost coverage %</span>
              <span className="muted">* still maturing</span>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
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
                    <th className="num">Auto-boosted (72h)</th>
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
                      <td className="num">{fmtInt(c.boosted72h)} <span className="muted">({fmtPct(c.boostRate)})</span></td>
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
