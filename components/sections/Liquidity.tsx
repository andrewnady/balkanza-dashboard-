"use client";

import { useState } from "react";
import { useMetrics, Segmented, SectionHead, CardSkeleton, ErrorNote, fmtInt, fmtPct } from "../ui/primitives";
import { GroupedBars } from "../ui/charts";

const GENDERS = [
  { label: "All", value: "all" },
  { label: "Men", value: "male" },
  { label: "Women", value: "female" },
];
const MINS = [
  { label: "≥1", value: 1 },
  { label: "≥5", value: 5 },
  { label: "≥10", value: 10 },
  { label: "≥25", value: 25 },
];
const LIMITS = [
  { label: "Top 10", value: 10 },
  { label: "Top 15", value: 15 },
  { label: "Top 25", value: 25 },
];

export default function Liquidity() {
  const [gender, setGender] = useState<string>("all");
  const [min, setMin] = useState<number>(5);
  const [limit, setLimit] = useState<number>(15);
  const { data, error, loading } = useMetrics<any>("liquidity", { gender, min, limit });

  const maxUsers = data ? Math.max(1, ...data.rows.map((r: any) => r.users)) : 1;

  return (
    <section className="section" id="liquidity">
      <SectionHead
        id="liquidity-h"
        title="Market liquidity"
        desc="Density of complete profiles by residence country — where there's enough supply for the marketplace to work."
      >
        <span className="filter-label">Gender</span>
        <Segmented value={gender} options={GENDERS} onChange={setGender} />
        <span className="filter-label">Min</span>
        <Segmented value={min} options={MINS} onChange={setMin} />
        <span className="filter-label">Show</span>
        <Segmented value={limit} options={LIMITS} onChange={setLimit} />
      </SectionHead>

      {error ? (
        <ErrorNote msg={error} />
      ) : (
        <div className="grid grid-2">
          <div className="card">
            <p className="card-title">Top countries by residence</p>
            <p className="card-note">
              Complete profiles{gender !== "all" ? ` · ${gender === "male" ? "men" : "women"} only` : ""} · min {min} per country.
            </p>
            {loading || !data ? (
              <CardSkeleton height={340} />
            ) : (
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Country</th>
                      <th className="num">Users</th>
                      <th className="num">Men</th>
                      <th className="num">Women</th>
                      <th className="num">M:F</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r: any) => (
                      <tr key={r.country}>
                        <td style={{ fontWeight: 600 }}>{r.country}</td>
                        <td className="num barcell">
                          <span className="bar" style={{ width: `${(100 * r.users) / maxUsers}%` }} />
                          <span className="val">{fmtInt(r.users)}</span>
                        </td>
                        <td className="num">{fmtInt(r.men)}</td>
                        <td className="num">{fmtInt(r.women)}</td>
                        <td className="num muted">{r.women ? `${(r.men / r.women).toFixed(1)}:1` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="card">
            <p className="card-title">Gender split of complete profiles</p>
            <p className="card-note">Overall supply balance across the platform.</p>
            {loading || !data ? (
              <CardSkeleton height={300} />
            ) : (
              <>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 8 }}>
                  {data.genderMix.slice(0, 5).map((g: any, i: number) => {
                    const total = data.genderMix.reduce((s: number, x: any) => s + x.users, 0) || 1;
                    return (
                      <div key={g.gender}>
                        <div className="tile-value" style={{ fontSize: 22 }}>{fmtPct((100 * g.users) / total)}</div>
                        <div className="tile-sub">{g.gender} · {fmtInt(g.users)}</div>
                      </div>
                    );
                  })}
                </div>
                <GroupedBars
                  data={data.rows.slice(0, 8)}
                  labelKey="country"
                  series={[
                    { key: "men", name: "Men", color: "var(--series-1)" },
                    { key: "women", name: "Women", color: "var(--series-7)" },
                  ]}
                />
                <div className="legend">
                  <span><span className="dot" style={{ background: "var(--series-1)" }} />Men</span>
                  <span><span className="dot" style={{ background: "var(--series-7)" }} />Women</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
