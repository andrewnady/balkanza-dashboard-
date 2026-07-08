"use client";

import { useState } from "react";
import { useMetrics, Segmented, SectionHead, CardSkeleton, ErrorNote, StatTile, fmtInt, fmtMoney, fmtPct } from "../ui/primitives";
import { TrendArea } from "../ui/charts";

const RANGES = [
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

export default function Monetization() {
  const [days, setDays] = useState<number>(30);
  const { data, error, loading } = useMetrics<any>("monetization", { days });

  return (
    <section className="section" id="monetization">
      <SectionHead id="monetization-h" title="Monetization" desc="Revenue, subscriptions, offers and payment health.">
        <span className="filter-label">Window</span>
        <Segmented value={days} options={RANGES} onChange={setDays} />
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
                <strong>Payment health warning:</strong> {fmtPct(data.payments.failRate)} of subscription payments in the last {days} days are
                recorded as not <code>paid</code> ({data.payments.failed} of {data.payments.total}). Verify whether payments are genuinely
                failing or the status value differs from <code>paid</code>.
              </div>
            </div>
          )}

          <div className="grid grid-3" style={{ marginBottom: 16 }}>
            <div className="card">
              <p className="card-title">Revenue trend</p>
              <p className="card-note">Paid one-time purchases per day.</p>
              <TrendArea data={data.revenueTrend} xKey="date" yKey="revenue" color="var(--series-4)" valueFmt={fmtMoney} height={190} />
            </div>
            <StatTile
              label="Subscription payment success"
              value={data.payments.total ? 100 - data.payments.failRate : 0}
              sub={`${data.payments.succeeded}/${data.payments.total} succeeded`}
              format="pct"
            />
            <StatTile
              label="Best offer claim rate"
              value={data.offers.length ? Math.max(...data.offers.map((o: any) => o.claimRate)) : 0}
              sub={data.offers[0] ? `${data.offers[0].name}` : "no offers"}
              format="pct"
            />
          </div>

          <div className="grid grid-2">
            <div className="card">
              <p className="card-title">Revenue by service ({days}d)</p>
              {data.services.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>No paid one-time purchases in this window.</p>
              ) : (
                <div className="tbl-scroll">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Service</th>
                        <th className="num">Purchases</th>
                        <th className="num">Units</th>
                        <th className="num">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.services.map((s: any) => (
                        <tr key={s.service}>
                          <td style={{ fontWeight: 600 }}>{s.service}</td>
                          <td className="num">{fmtInt(s.purchases)}</td>
                          <td className="num">{fmtInt(s.units)}</td>
                          <td className="num">{fmtMoney(s.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="card">
              <p className="card-title">Active subscription plans</p>
              <p className="card-note">Where paying users actually sit — watch for duplicate price points.</p>
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
                    {data.plans.map((p: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                        <td className="num">{fmtMoney(p.price)}</td>
                        <td className="muted">{p.duration}</td>
                        <td className="num">{fmtInt(p.active)}</td>
                      </tr>
                    ))}
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
