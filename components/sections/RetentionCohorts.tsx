"use client";

import { useMetrics, SectionHead, CardSkeleton, ErrorNote, fmtInt, fmtPct } from "../ui/primitives";

// Crimson intensity by retention %.
function cellStyle(pct: number | undefined): React.CSSProperties {
  if (pct === undefined) return { background: "transparent", color: "var(--text-muted)" };
  const alpha = Math.max(0.06, Math.min(0.92, pct / 100));
  return { background: `rgba(225,29,72,${alpha})`, color: alpha > 0.5 ? "#fff" : "var(--text-primary)", fontWeight: 600 };
}

export default function RetentionCohorts() {
  const { data, error, loading } = useMetrics<any>("retention-cohorts", {});
  const weeks = data ? Array.from({ length: data.maxWeek + 1 }, (_, i) => i) : [];

  return (
    <section className="section" id="retention">
      <SectionHead id="retention-h" title="Cohort retention" desc="Of each week's sign-up cohort, the share still taking an action (swipe or message) in later weeks. Week 0 = the cohort itself." />

      {error ? (
        <ErrorNote msg={error} />
      ) : loading || !data ? (
        <CardSkeleton height={320} />
      ) : (
        <div className="card">
          <p className="card-title">Weekly retention triangle</p>
          <p className="card-note">Darker = higher retention. Read across a row to see how fast a cohort decays.</p>
          <div className="tbl-scroll">
            <table className="tbl heatmap">
              <thead>
                <tr>
                  <th>Cohort week</th>
                  <th className="num">Size</th>
                  {weeks.map((w) => (
                    <th key={w} className="num">W{w}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.cohorts.map((c: any) => (
                  <tr key={c.week}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{c.week}</td>
                    <td className="num muted">{fmtInt(c.size)}</td>
                    {weeks.map((w) => {
                      const pct = c.cells[w];
                      return (
                        <td key={w} className="num heat-cell" style={cellStyle(pct)}>
                          {pct === undefined ? "" : fmtPct(pct)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="card-note" style={{ marginTop: 10 }}>
            &ldquo;Active&rdquo; means the user swiped or sent a message that week. Passive-only sessions aren&apos;t counted, so this is
            <strong> engaged</strong> retention — the number that predicts matches and revenue.
          </p>
        </div>
      )}
    </section>
  );
}
