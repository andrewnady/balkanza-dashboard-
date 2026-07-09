"use client";

import { useState } from "react";
import { useMetrics, PeriodFilter, PeriodValue, periodLabel, SectionHead, CardSkeleton, ErrorNote, StatTile, fmtInt, fmtMoney, fmtPct } from "../ui/primitives";
import { TrendArea } from "../ui/charts";

const RANGES = [
  { label: "Today", value: 1 },
  { label: "7 days", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

// fixed colours per revenue type (categorical palette)
const TYPE_COLORS: Record<string, string> = {
  Subscriptions: "var(--series-1)",
  Renewals: "var(--series-5)",
  Roses: "var(--series-7)",
  "Super Likes": "var(--series-2)",
  Boosts: "var(--series-3)",
};

export default function Monetization() {
  const [period, setPeriod] = useState<PeriodValue>({ days: 1 });
  const { data, error, loading } = useMetrics<any>("monetization", period);
  const label = periodLabel(period);

  return (
    <section className="section" id="monetization">
      <SectionHead id="monetization-h" title="Monetization" desc="Revenue, subscriptions, offers and payment health.">
        <span className="filter-label">Window</span>
        <PeriodFilter presets={RANGES} value={period} onChange={setPeriod} />
      </SectionHead>

      {error ? (
        <ErrorNote msg={error} />
      ) : loading || !data ? (
        <div className="grid grid-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} height={220} />
          ))}
        </div>
      ) : (
        <>
          {data.payments.total > 0 && data.payments.failRate >= 50 && (
            <div className="callout crit" style={{ marginBottom: 16 }}>
              <span className="callout-icon">🚨</span>
              <div>
                <strong>Payment health warning:</strong> {fmtPct(data.payments.failRate)} of subscription payments in this window failed
                ({data.payments.failed} of {data.payments.total}).
              </div>
            </div>
          )}

          <div className="grid grid-3" style={{ marginBottom: 16 }}>
            <div className="card col-span-2">
              <p className="card-title">Revenue trend — all sources</p>
              <p className="card-note">
                Subscriptions, renewals, roses, super likes &amp; boosts per day · total {fmtMoney(data.totalRevenue)} this window.
              </p>
              <TrendArea data={data.revenueTrend} xKey="date" yKey="revenue" color="var(--series-4)" valueFmt={fmtMoney} height={190} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <StatTile label="Total revenue" value={data.totalRevenue} sub={label} format="money" />
              <StatTile
                label="Subscription payment success"
                value={data.payments.total ? 100 - data.payments.failRate : 0}
                sub={`${data.payments.succeeded}/${data.payments.total} succeeded`}
                format="pct"
              />
            </div>
          </div>

          <div className="grid grid-2">
            <div className="card">
              <p className="card-title">Revenue by service · {label}</p>
              <p className="card-note">Subscriptions, renewals, roses, super likes &amp; boosts.</p>
              {data.revenueByType.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>No revenue in this window.</p>
              ) : (
                <div className="tbl-scroll">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th className="num">Transactions</th>
                        <th className="num">Revenue</th>
                        <th className="num">% of total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.revenueByType.map((s: any) => (
                        <tr key={s.type}>
                          <td style={{ fontWeight: 600 }}>
                            <span className="dot" style={{ background: TYPE_COLORS[s.type] || "var(--series-8)" }} />
                            {s.type}
                          </td>
                          <td className="num">{fmtInt(s.transactions)}</td>
                          <td className="num">{fmtMoney(s.revenue)}</td>
                          <td className="num muted">{fmtPct(data.totalRevenue ? (100 * s.revenue) / data.totalRevenue : 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td style={{ fontWeight: 700, borderTop: "1px solid var(--border)" }}>Total</td>
                        <td className="num" style={{ fontWeight: 700, borderTop: "1px solid var(--border)" }}>
                          {fmtInt(data.revenueByType.reduce((a: number, r: any) => a + r.transactions, 0))}
                        </td>
                        <td className="num" style={{ fontWeight: 700, borderTop: "1px solid var(--border)" }}>{fmtMoney(data.totalRevenue)}</td>
                        <td className="num muted" style={{ borderTop: "1px solid var(--border)" }}>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
            <div className="card">
              <p className="card-title">Active subscription plans</p>
              <p className="card-note">Where paying users actually sit — click a plan to see its subscribers.</p>
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th className="num">Price</th>
                      <th>Duration</th>
                      <th className="num">Active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.plans.map((p: any, i: number) => {
                      const href = `/subscribers?name=${encodeURIComponent(p.name)}&price=${p.price}&duration=${encodeURIComponent(p.duration)}`;
                      return (
                        <tr key={i} className="row-link" onClick={() => { window.location.href = href; }}>
                          <td style={{ fontWeight: 600 }}><span className="row-link-name">{p.name} ↗</span></td>
                          <td className="num">{fmtMoney(p.price)}</td>
                          <td className="muted">{p.duration}</td>
                          <td className="num">{fmtInt(p.active)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {data.offers.length > 0 && (
            <div className="card" style={{ marginTop: 16 }}>
              <p className="card-title">Offer performance</p>
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Offer</th>
                      <th className="num">Impressions</th>
                      <th className="num">Claimed</th>
                      <th className="num">Claim rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.offers.map((o: any) => (
                      <tr key={o.name}>
                        <td style={{ fontWeight: 600 }}>{o.name}</td>
                        <td className="num">{fmtInt(o.impressions)}</td>
                        <td className="num">{fmtInt(o.claimed)}</td>
                        <td className="num">
                          <span className={`badge ${o.claimRate >= 3 ? "good" : "warn"}`}>{fmtPct(o.claimRate)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
