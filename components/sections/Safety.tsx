"use client";

import { useState, type ReactNode } from "react";
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

function Chip({ n, label }: { n: number; label: string }) {
  return (
    <div className="signal-chip">
      <span className={`signal-chip-n ${n > 0 ? "on" : "off"}`}>{fmtInt(n)}</span>
      <span className="signal-chip-label">{label}</span>
    </div>
  );
}

// Expandable list of clusters, each revealing its member accounts as profile links.
function ClusterGroup({ title, clusters }: { title: string; clusters: { label: ReactNode; count: number; members: any[] }[] }) {
  if (!clusters.length) return null;
  return (
    <div className="signal-group">
      <p className="cluster-head-label">{title}</p>
      <div className="cluster-list">
        {clusters.map((c, i) => (
          <details key={i} className="cluster">
            <summary>
              <span className="caret" />
              <span className="cluster-label">{c.label}</span>
              <span className="muted">{c.count} accounts</span>
            </summary>
            <MemberList members={c.members} />
          </details>
        ))}
      </div>
    </div>
  );
}

// Shorten a user-agent to something recognisable for the cluster label.
function shortUA(ua: string): string {
  const m = ua.match(/(Chrome|Firefox|Safari|Edg|OPR|SamsungBrowser|CriOS|FxiOS)[/ ]?([\d.]+)?/i);
  const os = ua.match(/\((?:[^;)]*;\s*)?([^;)]+)/);
  const browser = m ? m[1].replace("Edg", "Edge").replace("CriOS", "Chrome iOS").replace("OPR", "Opera") : "device";
  return `${browser}${os ? " · " + os[1].trim() : ""}`;
}

export default function Safety() {
  const [period, setPeriod] = useState<PeriodValue>({ days: 1 });
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

          <div className="grid grid-2">
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
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <p className="card-title">Spam &amp; abuse signals · {label}</p>
            <p className="card-note">Signals of fake or farmed accounts. Click any group to reveal the accounts and open their profiles.</p>

            <div className="signal-chips">
              <Chip n={data.ipClusters.length} label="shared-IP clusters" />
              <Chip n={data.deviceClusters.length} label="shared-device clusters" />
              <Chip n={data.duplicateBios.length} label="duplicate bios" />
              <Chip n={data.reportedUsers.length} label="repeatedly reported" />
              <Chip n={data.botEmails.total} label="bot-like emails" />
            </div>

            {data.ipClusters.length + data.deviceClusters.length + data.duplicateBios.length + data.reportedUsers.length + data.botEmails.total === 0 ? (
              <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>No spam signals in this window. Widen the range (try “All time”) to scan the whole base.</p>
            ) : (
              <div className="grid grid-2" style={{ marginTop: 12 }}>
                <div>
                  <ClusterGroup
                    title="Shared-IP clusters"
                    clusters={data.ipClusters.map((c: any) => ({ label: <span className="mono">{c.ip}</span>, count: c.accounts, members: c.members }))}
                  />
                  <ClusterGroup
                    title="Shared device fingerprints"
                    clusters={data.deviceClusters.map((c: any) => ({ label: shortUA(c.ua), count: c.accounts, members: c.members }))}
                  />
                  <ClusterGroup
                    title="Duplicate bios"
                    clusters={data.duplicateBios.map((d: any) => ({ label: `“${d.bio.slice(0, 46)}${d.bio.length > 46 ? "…" : ""}”`, count: d.num, members: d.members }))}
                  />
                </div>
                <div>
                  {data.reportedUsers.length > 0 && (
                    <div className="signal-group">
                      <p className="cluster-head-label">Repeatedly-reported users</p>
                      <ul className="member-list boxed">
                        {data.reportedUsers.map((u: any) => (
                          <li key={u.id}>
                            <a href={profileUrl(u.id)} target="_blank" rel="noreferrer">{u.name || u.email || u.id} ↗</a>
                            <span className="muted"> · {u.reports} reports · {String(u.category).replace(/_/g, " ")}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.botEmails.total > 0 && (
                    <div className="signal-group">
                      <p className="cluster-head-label">Bot-like emails ({fmtInt(data.botEmails.total)})</p>
                      <ul className="member-list boxed">
                        {data.botEmails.sample.map((m: any) => (
                          <li key={m.id}>
                            <a href={profileUrl(m.id)} target="_blank" rel="noreferrer">{m.email} ↗</a>
                            {m.name && <span className="muted"> · {m.name}</span>}
                          </li>
                        ))}
                      </ul>
                      {data.botEmails.total > data.botEmails.sample.length && (
                        <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>+{fmtInt(data.botEmails.total - data.botEmails.sample.length)} more</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
