"use client";

import { useState } from "react";
import { useMetrics, SESSION_ASOF, PeriodFilter, PeriodValue, SectionHead, CardSkeleton, ErrorNote, fmtInt, fmtPct } from "../ui/primitives";
import { HBars } from "../ui/charts";

const RANGES = [
  { label: "Today", value: 1 },
  { label: "7d", value: 7 },
  { label: "28d", value: 28 },
  { label: "90d", value: 90 },
];

// ordinal blue ramp (dark → light not allowed below step 250 on light surface)
const FUNNEL_COLORS = ["#184f95", "#256abf", "#3987e5", "#5598e7", "#86b6ef"];

const STAGE_TYPE: Record<string, string> = {
  Registered: "signups",
  "Completed profile": "completed",
  "Sent a like": "liked",
  "Got a match": "matched",
  "Sent a message": "messaged",
};

function periodQuery(v: PeriodValue): string {
  if (v.range === "all") return "range=all";
  if (v.from && v.to) return `from=${v.from}&to=${v.to}`;
  return `days=${v.days ?? 28}`;
}

function Delta({ cur, prev, hasPrev }: { cur: number; prev: number; hasPrev: boolean }) {
  if (!hasPrev) return <span className="delta flat">—</span>;
  if (prev === 0) return <span className="delta flat">{cur > 0 ? "new" : "–"}</span>;
  const pct = (100 * (cur - prev)) / prev;
  const up = cur >= prev;
  return (
    <span className={`delta ${up ? "up" : "down"}`}>
      {up ? "▲" : "▼"} {Math.abs(Math.round(pct * 10) / 10)}%
    </span>
  );
}

export default function Funnel() {
  const [period, setPeriod] = useState<PeriodValue>({ days: 1 });
  const { data, error, loading } = useMetrics<any>("funnel", period);
  const hasPrev = data?.period?.hasPrev ?? true;
  const prevLabel = data?.period?.prevLabel ?? "prev";

  return (
    <section className="section" id="funnel">
      <SectionHead
        id="funnel-h"
        title="Activation funnel"
        desc="For users who registered in the window: how far they get down register → complete → like → match → message — compared to the same period before."
      >
        <span className="filter-label">Cohort</span>
        <PeriodFilter presets={RANGES} value={period} onChange={setPeriod} />
      </SectionHead>

      {error ? (
        <ErrorNote msg={error} />
      ) : (
        <div>
          <div className="card">
            <p className="card-title">Funnel — distinct users per stage</p>
            <p className="card-note">
              Bars = this period&apos;s cohort. Table compares each stage with {prevLabel}.
            </p>
            {loading || !data ? (
              <CardSkeleton height={260} />
            ) : (
              <>
                <HBars data={data.stages} labelKey="stage" valueKey="users" colors={FUNNEL_COLORS} valueFmt={fmtInt} />
                <div className="tbl-scroll" style={{ marginTop: 8 }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Stage</th>
                        <th className="num">This period</th>
                        <th className="num">{prevLabel}</th>
                        <th className="num">Δ</th>
                        <th className="num">% of reg.</th>
                        <th className="num">Step</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stages.map((s: any, i: number) => {
                        const href = `/users?type=${STAGE_TYPE[s.stage] || "signups"}&${periodQuery(period)}&asof=${encodeURIComponent(SESSION_ASOF)}`;
                        return (
                        <tr key={s.stage} className="row-link" onClick={() => { window.location.href = href; }}>
                          <td style={{ fontWeight: 600 }}>
                            <span className="dot" style={{ background: FUNNEL_COLORS[i] }} />
                            <span className="row-link-name">{s.stage} ↗</span>
                          </td>
                          <td className="num" style={{ fontWeight: 700 }}>{fmtInt(s.users)}</td>
                          <td className="num muted">{hasPrev ? fmtInt(s.prevUsers) : "—"}</td>
                          <td className="num"><Delta cur={s.users} prev={s.prevUsers} hasPrev={hasPrev} /></td>
                          <td className="num muted">{fmtPct(s.pctOfTop)}</td>
                          <td className="num muted">{i === 0 ? "—" : fmtPct(s.stepConversion)}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
