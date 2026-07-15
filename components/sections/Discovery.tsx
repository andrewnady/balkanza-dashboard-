"use client";

import { useState } from "react";
import { useMetrics, PeriodFilter, PeriodValue, periodLabel, SectionHead, CardSkeleton, ErrorNote, StatTile, fmtInt } from "../ui/primitives";
import { MultiAxisBars } from "../ui/charts";

const RANGES = [
  { label: "7d", value: 7 },
  { label: "14d", value: 14 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

const PROFILE_BLUE = "#2563eb";
const MATCHCARD_RED = "#e23744";
const BOOST_PURPLE = "#7c4dff";

function Legend({ items }: { items: { name: string; color: string }[] }) {
  return (
    <div className="chart-legend">
      {items.map((i) => (
        <span key={i.name} className="legend-item">
          <span className="legend-dot" style={{ background: i.color }} />
          {i.name}
        </span>
      ))}
    </div>
  );
}

export default function Discovery() {
  const [period, setPeriod] = useState<PeriodValue>({ days: 30 });
  const { data, error, loading } = useMetrics<any>("views-boosts", period);
  const label = periodLabel(period);

  return (
    <section className="section" id="discovery">
      <SectionHead id="discovery-h" title="Discovery & boosts" desc="How much profiles get seen, and what boosts actually buy.">
        <span className="filter-label">Window</span>
        <PeriodFilter presets={RANGES} value={period} onChange={setPeriod} />
      </SectionHead>

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
            <StatTile label="Match-card views" value={data.totals.matchCardViews} sub={label} format="int" />
            <StatTile label="Profile views" value={data.totals.profileViews} sub={label} format="int" />
            <StatTile label="Boosts activated" value={data.totals.boosts} sub={label} format="int" />
            <StatTile label="Views from boosts" value={data.totals.boostedViews} sub="attributed to a boost" format="int" />
          </div>

          <div className="grid grid-2">
            <div className="card">
              <p className="card-title">View metrics · {label}</p>
              <p className="card-note">Daily match-card views (left axis) vs. profile views (right axis) — very different scales.</p>
              <MultiAxisBars
                data={data.daily}
                xKey="date"
                series={[
                  { key: "matchCardViews", name: "Match-card views", color: MATCHCARD_RED, axis: "left" },
                  { key: "profileViews", name: "Profile views", color: PROFILE_BLUE, axis: "right" },
                ]}
                leftFmt={fmtInt}
                rightFmt={fmtInt}
                height={280}
              />
              <Legend items={[{ name: "Match-card views", color: MATCHCARD_RED }, { name: "Profile views", color: PROFILE_BLUE }]} />
            </div>

            <div className="card">
              <p className="card-title">Boost performance &amp; engagement · {label}</p>
              <p className="card-note">Daily boosts (left axis) vs. views those boosts generated &amp; matches (right axis) — to judge boost impact.</p>
              <MultiAxisBars
                data={data.daily}
                xKey="date"
                series={[
                  { key: "boosts", name: "Boosts", color: BOOST_PURPLE, axis: "left" },
                  { key: "boostedViews", name: "Views from boosts", color: PROFILE_BLUE, axis: "right" },
                  { key: "matches", name: "Matches", color: MATCHCARD_RED, axis: "right" },
                ]}
                leftFmt={fmtInt}
                rightFmt={fmtInt}
                height={280}
              />
              <Legend items={[{ name: "Boosts", color: BOOST_PURPLE }, { name: "Views from boosts", color: PROFILE_BLUE }, { name: "Matches", color: MATCHCARD_RED }]} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
