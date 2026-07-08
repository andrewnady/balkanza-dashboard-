"use client";

import { useState } from "react";
import { useMetrics, PeriodFilter, PeriodValue, periodLabel, SectionHead, CardSkeleton, ErrorNote, StatTile, fmtInt, fmtPct } from "../ui/primitives";
import { HBars, TrendArea } from "../ui/charts";

const RANGES = [
  { label: "Today", value: 1 },
  { label: "7d", value: 7 },
  { label: "14d", value: 14 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

const VERIF_COLORS: Record<string, string> = {
  approved: "var(--series-4)",
  unverified: "var(--series-3)",
  pending: "var(--series-1)",
  rejected: "var(--series-6)",
};

// Where a flagged account links to. Override with NEXT_PUBLIC_PROFILE_URL_TEMPLATE
// (must contain "{id}") if your admin uses a different path.
const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL_TEMPLATE || "https://balkanza.com/profile/{id}";
const profileUrl = (id: string) => PROFILE_URL.replace("{id}", encodeURIComponent(id));

function MemberList({ members }: { members: { id: string; name: string | null; email: string | null }[] }) {
  return (
    <ul className="member-list">
      {members.map((m) => (
        <li key={m.id}>
          <a href={profileUrl(m.id)} target="_blank" rel="noreferrer">
            {m.name || m.email || m.id} ↗
          </a>
          {m.name && m.email && <span className="muted"> · {m.email}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function Safety() {
  const [period, setPeriod] = useState<PeriodValue>({ range: "all" });
  const { data, error, loading } = useMetrics<any>("safety", period);
  const label = periodLabel(period);

  const heritagePct = data && data.quality.complete ? (100 * data.quality.missing_heritage) / data.quality.complete : 0;

  return (
    <section className="section" id="safety">
      <SectionHead id="safety-h" title="Trust, safety & data quality" desc="Spam signals, verification, and gaps in critical profile data.">
        <span className="filter-label">Reports window</span>
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
          {heritagePct >= 90 && (
            <div className="callout crit" style={{ marginBottom: 16 }}>
              <span className="callout-icon">🚩</span>
              <div>
                <strong>Heritage data missing for {fmtPct(heritagePct)} of complete profiles.</strong> For a diaspora dating app this field is
                core to matching and targeting — it&apos;s effectively unpopulated. Highest-priority data fix.
              </div>
            </div>
          )}

          <div className="grid grid-4" style={{ marginBottom: 16 }}>
            <StatTile label="Bios with contact info" value={data.spamBios} sub="whatsapp / telegram / @handles / phone" format="int" goodDirection="down" />
            <StatTile label="Complete profiles, no photo" value={data.zeroPhotos} sub="can't function in-app" format="int" goodDirection="down" />
            <StatTile label="Missing gender" value={data.quality.missing_gender} sub={`of ${fmtInt(data.quality.complete)} complete`} format="int" goodDirection="down" />
            <StatTile label="Missing birthdate" value={data.quality.missing_birthdate} sub={`of ${fmtInt(data.quality.complete)} complete`} format="int" goodDirection="down" />
          </div>

          <div className="grid grid-3">
            <div className="card">
              <p className="card-title">Verification funnel</p>
              <p className="card-note">Where users sit in identity verification.</p>
              <HBars
                data={data.verification}
                labelKey="status"
                valueKey="users"
                colors={data.verification.map((v: any) => VERIF_COLORS[v.status] || "var(--series-5)")}
                valueFmt={fmtInt}
              />
            </div>
            <div className="card">
              <p className="card-title">Report volume · {label}</p>
              <p className="card-note">Profile reports filed per day.</p>
              {data.reports.length === 0 ? (
                <p className="muted" style={{ fontSize: 13 }}>No reports in this window.</p>
              ) : (
                <TrendArea data={data.reports} xKey="date" yKey="reports" color="var(--series-6)" valueFmt={fmtInt} height={200} />
              )}
            </div>
            <div className="card">
              <p className="card-title">Spam-farm signals</p>
              <p className="card-note">Duplicate bios & shared-IP account clusters.</p>
              <div style={{ display: "flex", gap: 22, marginBottom: 12 }}>
                <div>
                  <div className="tile-value" style={{ fontSize: 22 }}>{fmtInt(data.duplicateBios.length)}</div>
                  <div className="tile-sub">duplicate bio texts</div>
                </div>
                <div>
                  <div className="tile-value" style={{ fontSize: 22 }}>{fmtInt(data.ipClusters.length)}</div>
                  <div className="tile-sub">IPs with ≥3 accounts</div>
                </div>
              </div>
              {data.ipClusters.length > 0 && (
                <>
                  <p className="cluster-head-label">Shared-IP clusters · click to see accounts</p>
                  <div className="cluster-list">
                    {data.ipClusters.slice(0, 8).map((c: any) => (
                      <details key={c.ip} className="cluster">
                        <summary>
                          <span className="caret" />
                          <span className="mono" style={{ flex: 1 }}>{c.ip}</span>
                          <span className="muted">{c.accounts} accounts</span>
                        </summary>
                        <MemberList members={c.members} />
                      </details>
                    ))}
                  </div>
                </>
              )}
              {data.duplicateBios.length > 0 && (
                <>
                  <p className="cluster-head-label">Duplicate bios · click to see accounts</p>
                  <div className="cluster-list">
                    {data.duplicateBios.slice(0, 8).map((d: any, i: number) => (
                      <details key={i} className="cluster">
                        <summary>
                          <span className="caret" />
                          <span className="bio-snip" style={{ flex: 1 }}>“{d.bio.slice(0, 42)}{d.bio.length > 42 ? "…" : ""}”</span>
                          <span className="muted">{d.num} accounts</span>
                        </summary>
                        <MemberList members={d.members} />
                      </details>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
