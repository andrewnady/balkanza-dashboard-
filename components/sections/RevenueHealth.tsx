"use client";

import { useMetrics, SectionHead, CardSkeleton, ErrorNote, StatTile, fmtInt, fmtPct, fmtMoney } from "../ui/primitives";

export default function RevenueHealth() {
  const { data, error, loading } = useMetrics<any>("revenue-health", {});

  return (
    <section className="section" id="revenue-health">
      <SectionHead id="revenue-health-h" title="Revenue health" desc="Subscription economics — recurring revenue, churn, lifetime value, and money left on the table. Live snapshot." />

      {error ? (
        <ErrorNote msg={error} />
      ) : loading || !data ? (
        <div className="grid grid-4">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} height={110} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <StatTile label="MRR" value={data.mrr} sub={`${fmtInt(data.activeSubs)} active subs · ARR ${fmtMoney(data.arr)}`} format="money" />
            <StatTile label="Monthly churn" value={data.churn.monthlyChurnPct} sub={`${fmtInt(data.churn.ended)} lost / ${fmtInt(data.churn.activeNow)} active · 30d`} format="pct" goodDirection="down" />
            <StatTile label="Est. subscriber LTV" value={data.ltv} sub={`avg sub ${fmtMoney(data.avgAmount)} ÷ churn`} format="money" />
            <StatTile label="Revenue per payer" value={data.revPerPayer} sub={`${fmtInt(data.payers)} lifetime payers`} format="money" />
          </div>

          {data.recovery.lost > 0 && (
            <div className="callout crit" style={{ marginBottom: 16 }}>
              <span className="callout-icon">💸</span>
              <div>
                <strong>Involuntary churn is leaking subscribers.</strong> {fmtInt(data.recovery.withFailure)} subscriptions hit a
                payment failure and only <strong>{fmtInt(data.recovery.recovered)}</strong> were recovered ({fmtPct(data.recovery.recoveredPct)}) —
                <strong> {fmtInt(data.recovery.lost)} lost to failed billing</strong>. A dunning flow (retries + "update your card" emails/push)
                is likely the cheapest revenue you can win back.
              </div>
            </div>
          )}

          <div className="grid grid-3">
            <div className="card">
              <p className="card-title">Failed-payment recovery</p>
              <div className="tbl-scroll">
                <table className="tbl">
                  <tbody>
                    <tr><td>Subs with a failure</td><td className="num">{fmtInt(data.recovery.withFailure)}</td></tr>
                    <tr><td>Recovered</td><td className="num"><span className="badge good">{fmtInt(data.recovery.recovered)}</span></td></tr>
                    <tr><td>Lost to billing</td><td className="num"><span className="badge crit">{fmtInt(data.recovery.lost)}</span></td></tr>
                    <tr><td>Recovery rate</td><td className="num">{fmtPct(data.recovery.recoveredPct)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <p className="card-title">Repeat à-la-carte buyers</p>
              <div className="tbl-scroll">
                <table className="tbl">
                  <tbody>
                    <tr><td>One-time buyers</td><td className="num">{fmtInt(data.repeat.buyers)}</td></tr>
                    <tr><td>Repeat buyers (2+)</td><td className="num">{fmtInt(data.repeat.repeatBuyers)}</td></tr>
                    <tr><td>Repeat rate</td><td className="num">{fmtPct(data.repeat.repeatPct)}</td></tr>
                    <tr><td>Avg purchases / buyer</td><td className="num">{fmtInt(data.repeat.avgPurchases)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <p className="card-title">Refunds</p>
              <div className="tbl-scroll">
                <table className="tbl">
                  <tbody>
                    <tr><td>Refunded payments</td><td className="num">{fmtInt(data.refunds.count)}</td></tr>
                    <tr><td>Amount refunded</td><td className="num">{fmtMoney(data.refunds.amount)}</td></tr>
                    <tr><td>Total sub revenue</td><td className="num">{fmtMoney(data.totalSubRevenue)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
