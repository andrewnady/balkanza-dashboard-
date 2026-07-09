"use client";

import { useState } from "react";
import { useMetrics, SESSION_ASOF, PeriodFilter, PeriodValue, SectionHead, CardSkeleton, ErrorNote, StatTile, fmtInt, fmtPct } from "../ui/primitives";
import { HBars } from "../ui/charts";

const RANGES = [
  { label: "Today", value: 1 },
  { label: "7d", value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

function periodQuery(v: PeriodValue): string {
  if (v.range === "all") return "range=all";
  if (v.from && v.to) return `from=${v.from}&to=${v.to}`;
  return `days=${v.days ?? 30}`;
}

export default function Engagement() {
  const [period, setPeriod] = useState<PeriodValue>({ days: 1 });
  const { data, error, loading } = useMetrics<any>("engagement", period);
  const matchesHref = (type: string) => `/matches?type=${type}&${periodQuery(period)}&asof=${encodeURIComponent(SESSION_ASOF)}`;

  return (
    <section className="section" id="engagement">
      <SectionHead id="engagement-h" title="Engagement" desc="Do matches turn into conversations, and do people come back?">
        <span className="filter-label">Window</span>
        <PeriodFilter presets={RANGES} value={period} onChange={setPeriod} />
      </SectionHead>

      {error ? (
        <ErrorNote msg={error} />
      ) : loading || !data ? (
        <div className="grid grid-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} height={200} />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <StatTile label="Matches in window" value={data.matchConvo.matches} format="int" href={matchesHref("all")} />
            <StatTile label="Matches that talked" value={data.matchConvo.talked} sub={`${fmtPct(data.matchConvo.pct)} of matches`} format="int" href={matchesHref("talked")} />
            <StatTile label="Dead matches (no message)" value={data.matchConvo.dead} sub="never exchanged a word" format="int" goodDirection="down" href={matchesHref("dead")} />
            <StatTile label="Like rate on swipes" value={data.swipes.likeRate} sub={`${fmtInt(data.swipes.swipes)} swipes`} format="pct" />
          </div>
          <div className="grid grid-2">
            <div className="card">
              <p className="card-title">Retention by cohort</p>
              <p className="card-note">% of a registration cohort active in the last 3 days.</p>
              <HBars
                data={data.retention.map((r: any) => ({ cohort: `${r.cohort} ago (n=${r.size})`, pct: r.pct }))}
                labelKey="cohort"
                valueKey="pct"
                colors={["var(--series-1)", "var(--series-1)", "var(--series-1)"]}
                valueFmt={fmtPct}
              />
            </div>
            <div className="card">
              <p className="card-title">Swipe outcomes</p>
              <p className="card-note">Likes vs passes across the window.</p>
              <HBars
                data={[
                  { k: "Likes", v: data.swipes.likes },
                  { k: "Passes", v: data.swipes.passes },
                ]}
                labelKey="k"
                valueKey="v"
                colors={["var(--series-2)", "var(--series-8)"]}
                valueFmt={fmtInt}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
