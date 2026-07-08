"use client";

import { useState } from "react";
import { useMetrics, Segmented, SectionHead, CardSkeleton, ErrorNote, fmtInt, fmtPct } from "../ui/primitives";
import { HBars, TrendLine } from "../ui/charts";

const RANGES = [
  { label: "7d cohort", value: 7 },
  { label: "30d cohort", value: 30 },
  { label: "90d cohort", value: 90 },
];

// ordinal blue ramp (dark → light not allowed below step 250 on light surface)
const FUNNEL_COLORS = ["#184f95", "#256abf", "#3987e5", "#5598e7", "#86b6ef"];

export default function Funnel() {
  const [days, setDays] = useState<number>(30);
  const { data, error, loading } = useMetrics<any>("funnel", { days });

  return (
    <section className="section" id="funnel">
      <SectionHead
        id="funnel-h"
        title="Activation funnel"
        desc="For users who registered in the window: how far down the register → complete → like → match → message path they get."
      >
        <span className="filter-label">Cohort</span>
        <Segmented value={days} options={RANGES} onChange={setDays} />
      </SectionHead>

      {error ? (
        <ErrorNote msg={error} />
      ) : (
        <div className="grid grid-3">
          <div className="card col-span-2">
            <p className="card-title">Funnel — distinct users per stage</p>
            <p className="card-note">Each bar is the number of unique users who reached that stage.</p>
            {loading || !data ? (
              <CardSkeleton height={260} />
            ) : (
              <>
                <HBars data={data.stages} labelKey="stage" valueKey="users" colors={FUNNEL_COLORS} valueFmt={fmtInt} />
                <div className="legend">
                  {data.stages.map((s: any, i: number) => (
                    <span key={s.stage}>
                      <span className="dot" style={{ background: FUNNEL_COLORS[i] }} />
                      {s.stage}: <strong>{fmtPct(s.pctOfTop)}</strong> of registered
                      {i > 0 && <span className="muted"> ({fmtPct(s.stepConversion)} step)</span>}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="card">
            <p className="card-title">Profile completion trend</p>
            <p className="card-note">% of daily registrants completing their profile (14d).</p>
            {loading || !data ? (
              <CardSkeleton height={220} />
            ) : (
              <TrendLine data={data.completion} xKey="date" yKey="pct_complete" color="var(--series-2)" valueFmt={fmtPct} domain={[0, 100]} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
