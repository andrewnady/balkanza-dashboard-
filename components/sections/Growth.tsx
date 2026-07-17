"use client";

import { useState } from "react";
import { useMetrics, PeriodFilter, PeriodValue, periodLabel, SectionHead, CardSkeleton, ErrorNote, fmtInt, fmtPct } from "../ui/primitives";
import { DualAxisTrend, HBars, SERIES } from "../ui/charts";

const RANGES = [
  { label: "Today", value: 1 },
  { label: "7d", value: 7 },
  { label: "14d", value: 14 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

export default function Growth() {
  const [period, setPeriod] = useState<PeriodValue>({ days: 7 });
  const { data, error, loading } = useMetrics<any>("growth", period);

  return (
    <section className="section" id="growth">
      <SectionHead id="growth-h" title="Growth & acquisition" desc="Daily registrations over time and where they come from.">
        <span className="filter-label">Window</span>
        <PeriodFilter presets={RANGES} value={period} onChange={setPeriod} />
      </SectionHead>

      {error ? (
        <ErrorNote msg={error} />
      ) : (
        <div className="grid grid-3">
          <div className="card col-span-2">
            <p className="card-title">Sign-ups, new matches &amp; profile completion per day</p>
            <p className="card-note">New registrations (area) &amp; new matches (line) on the left axis; % of that day&apos;s cohort completing their profile on the right axis, {periodLabel(period)}.</p>
            {loading || !data ? (
              <CardSkeleton height={240} />
            ) : (
              <>
                <DualAxisTrend
                  data={data.trend}
                  xKey="date"
                  areaKey="signups"
                  areaName="Sign-ups"
                  areaColor="var(--series-1)"
                  leftLine={{ key: "matches", name: "New matches", color: "#e23744" }}
                  lineKey="pctComplete"
                  lineName="Profile completion"
                  lineColor="var(--series-4)"
                  leftFmt={fmtInt}
                  rightFmt={fmtPct}
                />
                <div className="chart-legend">
                  <span className="legend-item"><span className="legend-dot" style={{ background: "var(--series-1)" }} />Sign-ups</span>
                  <span className="legend-item"><span className="legend-dot" style={{ background: "#e23744" }} />New matches</span>
                  <span className="legend-item"><span className="legend-dot" style={{ background: "var(--series-4)" }} />Profile completion %</span>
                </div>
              </>
            )}
          </div>
          <div className="card">
            <p className="card-title">Source mix</p>
            <p className="card-note">Registration channel.</p>
            {loading || !data ? (
              <CardSkeleton height={200} />
            ) : (
              <HBars data={data.sources} labelKey="source" valueKey="signups" colors={SERIES} valueFmt={fmtInt} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}
