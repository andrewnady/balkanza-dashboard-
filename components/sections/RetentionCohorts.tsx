"use client";

import { useMetrics, SectionHead, CardSkeleton, ErrorNote, fmtInt, fmtPct } from "../ui/primitives";

// Crimson intensity by retention %.
function cellStyle(pct: number | undefined): React.CSSProperties {
  if (pct === undefined) return { background: "transparent", color: "var(--text-muted)" };
  const alpha = Math.max(0.06, Math.min(0.92, pct / 100));
  return { background: `rgba(225,29,72,${alpha})`, color: alpha > 0.5 ? "#fff" : "var(--text-primary)", fontWeight: 600 };
}

// "2026-06-15" -> "Jun 15, 2026"
function weekLabel(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export default function RetentionCohorts() {
  const { data, error, loading } = useMetrics<any>("retention-cohorts", {});
  const weeks = data ? Array.from({ length: data.maxWeek + 1 }, (_, i) => i) : [];

  // A concrete, live example for the explainer (oldest cohort with a Week-1 value).
  const example = data ? [...data.cohorts].reverse().find((c: any) => c.cells[1] !== undefined) : null;

  return (
    <section className="section" id="retention">
      <SectionHead id="retention-h" title="Cohort retention" desc="Do the people who join actually keep using the app? Each row follows one week's new sign-ups over the following weeks." />

      {error ? (
        <ErrorNote msg={error} />
      ) : loading || !data ? (
        <CardSkeleton height={320} />
      ) : (
        <div className="card">
          <p className="card-title">Weekly retention triangle</p>

          {/* Plain-English how-to-read block for non-technical readers */}
          <div className="explainer">
            <p>
              <strong>How to read this:</strong> each <strong>row</strong> is a group of people who signed up in the same week
              (&ldquo;a cohort&rdquo;). Each <strong>column</strong> is how many weeks later it is:
            </p>
            <ul>
              <li><strong>Week 0</strong> = the week they signed up — always 100% (everyone is new that week).</li>
              <li><strong>Week 1</strong> = one week later, <strong>Week 2</strong> = two weeks later, and so on.</li>
              <li>Each cell = the % of that cohort still <strong>active</strong> (swiped or messaged) that week. <strong>Darker = better.</strong></li>
            </ul>
            {example && (
              <p className="explainer-eg">
                Example: of the <strong>{fmtInt(example.size)}</strong> people who joined the week of <strong>{weekLabel(example.week)}</strong>,{" "}
                <strong>{fmtPct(example.cells[1])}</strong> came back to swipe or message <strong>1 week later</strong>
                {example.cells[2] !== undefined && <>, and <strong>{fmtPct(example.cells[2])}</strong> were still active 2 weeks later</>}.
              </p>
            )}
          </div>

          <div className="tbl-scroll">
            <table className="tbl heatmap">
              <thead>
                <tr>
                  <th>Sign-up week</th>
                  <th className="num">People</th>
                  {weeks.map((w) => (
                    <th key={w} className="num" title={w === 0 ? "The week they signed up" : `${w} week${w === 1 ? "" : "s"} after signing up`}>
                      {w === 0 ? "Week 0" : `Week ${w}`}
                      <span className="th-sub">{w === 0 ? "joined" : `+${w}w`}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.cohorts.map((c: any) => (
                  <tr key={c.week}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{weekLabel(c.week)}</td>
                    <td className="num muted">{fmtInt(c.size)}</td>
                    {weeks.map((w) => {
                      const pct = c.cells[w];
                      return (
                        <td key={w} className="num heat-cell" style={cellStyle(pct)} title={pct === undefined ? "" : `${fmtPct(pct)} of the ${weekLabel(c.week)} cohort active ${w === 0 ? "at signup" : `${w} week(s) later`}`}>
                          {pct === undefined ? "" : fmtPct(pct)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="heat-legend">
            <span className="muted">Low retention</span>
            <span className="heat-swatch" style={{ background: "rgba(225,29,72,0.08)" }} />
            <span className="heat-swatch" style={{ background: "rgba(225,29,72,0.3)" }} />
            <span className="heat-swatch" style={{ background: "rgba(225,29,72,0.55)" }} />
            <span className="heat-swatch" style={{ background: "rgba(225,29,72,0.8)" }} />
            <span className="muted">High retention</span>
          </div>

          <p className="card-note" style={{ marginTop: 10 }}>
            &ldquo;Active&rdquo; means the user swiped or sent a message that week — passive browsing isn&apos;t counted, so this is
            <strong> engaged</strong> retention, the number that predicts matches and revenue. Empty cells are weeks that haven&apos;t happened yet.
          </p>
        </div>
      )}
    </section>
  );
}
