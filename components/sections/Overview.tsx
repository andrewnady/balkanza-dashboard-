"use client";

import { useState } from "react";
import { useMetrics, PeriodFilter, PeriodValue, StatTile, SectionHead, CardSkeleton, ErrorNote } from "../ui/primitives";

const RANGES = [
  { label: "Today", value: 1 },
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

function periodQuery(v: PeriodValue): string {
  if (v.range === "all") return "range=all";
  if (v.from && v.to) return `from=${v.from}&to=${v.to}`;
  return `days=${v.days ?? 30}`;
}

export default function Overview({ onFetched }: { onFetched?: (t: string | null) => void }) {
  const [period, setPeriod] = useState<PeriodValue>({ days: 1 });
  const { data, error, loading, fetchedAt } = useMetrics<any>("overview", period);

  if (onFetched && fetchedAt) onFetched(fetchedAt);

  const qp = periodQuery(period);
  const hrefFor = (key: string): string | undefined =>
    key === "signups" ? `/users?type=signups&${qp}`
      : key === "active" ? `/users?type=active&${qp}`
      : key === "matches" ? `/matches?type=all&${qp}`
      : undefined;

  return (
    <section className="section" id="overview">
      <SectionHead id="overview-h" title="Overview" desc="The headline numbers, current period vs the one before it.">
        <span className="filter-label">Period</span>
        <PeriodFilter presets={RANGES} value={period} onChange={setPeriod} />
      </SectionHead>

      {error ? (
        <ErrorNote msg={error} />
      ) : loading || !data ? (
        <div className="grid grid-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} height={110} />
          ))}
        </div>
      ) : (
        <div className="grid grid-6">
          {data.tiles.map((t: any) => (
            <StatTile
              key={t.key}
              label={t.label}
              value={t.value}
              prev={t.prev}
              sub={t.sub}
              format={t.format}
              goodDirection="up"
              href={hrefFor(t.key)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
