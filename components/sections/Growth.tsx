"use client";

import { useState } from "react";
import { useMetrics, PeriodFilter, PeriodValue, periodLabel, SectionHead, CardSkeleton, ErrorNote, fmtInt } from "../ui/primitives";
import { TrendArea, HBars, SERIES } from "../ui/charts";

const RANGES = [
  { label: "Today", value: 1 },
  { label: "7d", value: 7 },
  { label: "14d", value: 14 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

export default function Growth() {
  const [period, setPeriod] = useState<PeriodValue>({ days: 1 });
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
            <p className="card-title">Sign-ups per day</p>
            <p className="card-note">New non-admin registrations, {periodLabel(period)}.</p>
            {loading || !data ? <CardSkeleton height={220} /> : <TrendArea data={data.trend} xKey="date" yKey="signups" valueFmt={fmtInt} />}
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
