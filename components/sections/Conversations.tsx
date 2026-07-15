"use client";

import { useMetrics, SectionHead, CardSkeleton, ErrorNote, StatTile, fmtInt, fmtPct } from "../ui/primitives";
import { HBars } from "../ui/charts";

const FUNNEL_COLORS = ["var(--series-1)", "var(--series-2)", "var(--series-4)", "var(--series-7)"];

export default function Conversations() {
  const { data, error, loading } = useMetrics<any>("conversations", {});

  return (
    <section className="section" id="conversations">
      <SectionHead id="conversations-h" title="Conversation quality" desc="After a match, how far do conversations actually get? All-time across every matched pair." />

      {error ? (
        <ErrorNote msg={error} />
      ) : loading || !data ? (
        <div className="grid grid-2">
          <CardSkeleton height={300} />
          <CardSkeleton height={300} />
        </div>
      ) : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <StatTile label="Reply rate" value={data.replyRate} sub="of messaged matches get a reply" format="pct" />
            <StatTile label="Dead matches" value={data.deadPct} sub="no one ever messaged" format="pct" goodDirection="down" />
            <StatTile label="Median time to 1st message" value={data.medianHrsToFirst} sub="hours after matching" format="int" goodDirection="down" />
            <StatTile label="Avg messages (two-way)" value={data.avgMsgsTwoWay} sub="when both reply" format="int" />
          </div>

          <div className="grid grid-2">
            <div className="card">
              <p className="card-title">Match → conversation funnel</p>
              <p className="card-note">Distinct matched pairs progressing from a match to a sustained conversation.</p>
              <HBars
                data={data.funnel.map((s: any) => ({ label: s.stage, value: s.value }))}
                labelKey="label"
                valueKey="value"
                colors={FUNNEL_COLORS}
                valueFmt={fmtInt}
                height={220}
              />
            </div>
            <div className="card">
              <p className="card-title">Where conversations leak</p>
              <p className="card-note">% of all matches reaching each stage.</p>
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Stage</th>
                      <th className="num">Pairs</th>
                      <th className="num">% of matches</th>
                      <th className="num">Step drop</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.funnel.map((s: any, i: number) => {
                      const prev = i === 0 ? s.value : data.funnel[i - 1].value;
                      const step = i === 0 ? 100 : prev ? Math.round((1000 * s.value) / prev) / 10 : 0;
                      return (
                        <tr key={s.stage}>
                          <td style={{ fontWeight: 600 }}>
                            <span className="dot" style={{ background: FUNNEL_COLORS[i] }} />
                            {s.stage}
                          </td>
                          <td className="num">{fmtInt(s.value)}</td>
                          <td className="num muted">{fmtPct(s.pctOfMatches)}</td>
                          <td className="num">{i === 0 ? "—" : <span className={`badge ${step >= 60 ? "good" : step >= 35 ? "warn" : "crit"}`}>{fmtPct(step)}</span>}</td>
                        </tr>
                      );
                    })}
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
