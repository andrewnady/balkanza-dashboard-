"use client";

import { useMetrics, SectionHead, CardSkeleton, ErrorNote, StatTile, fmtInt, fmtPct } from "../ui/primitives";
import { GroupedBars } from "../ui/charts";

export default function Marketplace() {
  const { data, error, loading } = useMetrics<any>("marketplace", {});

  return (
    <section className="section" id="marketplace">
      <SectionHead id="marketplace-h" title="Marketplace health" desc="Supply balance and attention inequality — the signals that make or break a dating marketplace. Live snapshot." />

      {error ? (
        <ErrorNote msg={error} />
      ) : loading || !data ? (
        <div className="grid grid-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} height={110} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <StatTile label="Active men : women" value={data.genderRatio.ratio} sub={`${fmtInt(data.genderRatio.men)} men · ${fmtInt(data.genderRatio.women)} women · 7d`} format="int" goodDirection="down" />
            <StatTile label="Active men, 0 matches" value={data.zeroMatch.male.pct} sub={`${fmtInt(data.zeroMatch.male.zero)} of ${fmtInt(data.zeroMatch.male.active)} · 30d`} format="pct" goodDirection="down" />
            <StatTile label="Active women, 0 matches" value={data.zeroMatch.female.pct} sub={`${fmtInt(data.zeroMatch.female.zero)} of ${fmtInt(data.zeroMatch.female.active)} · 30d`} format="pct" goodDirection="down" />
            <StatTile label="Top 10% women's like share" value={data.concentration.top10Share} sub={`of ${fmtInt(data.concentration.totalLikes)} likes to women`} format="pct" goodDirection="down" />
          </div>

          <div className="callout crit" style={{ marginBottom: 16 }}>
            <span className="callout-icon">⚖️</span>
            <div>
              <strong>The market is supply-imbalanced and winner-take-all.</strong> With {data.genderRatio.ratio}:1 active men-to-women and{" "}
              <strong>{fmtPct(data.zeroMatch.male.pct)}</strong> of active men getting zero matches, most men experience an empty app —
              the #1 driver of churn. Meanwhile the top 10% of women absorb <strong>{fmtPct(data.concentration.top10Share)}</strong> of all likes
              (top 1%: {fmtPct(data.concentration.top1Share)}). Levers: acquire more women, cap/curate high-volume likers, and surface a wider set of women in discovery.
            </div>
          </div>

          <div className="card">
            <p className="card-title">Matches per active user — by gender</p>
            <p className="card-note">How matches are distributed across users active in the last 30 days. A healthy market has fewer people stuck at 0.</p>
            <GroupedBars
              data={data.distribution}
              labelKey="bucket"
              series={[
                { key: "male", name: "Men", color: "#2563eb" },
                { key: "female", name: "Women", color: "#e23744" },
              ]}
              height={280}
            />
            <div className="legend">
              <span><span className="dot" style={{ background: "#2563eb" }} />Men</span>
              <span><span className="dot" style={{ background: "#e23744" }} />Women</span>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
