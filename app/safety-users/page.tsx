"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useMetrics, fmtInt, fmtAgo } from "../../components/ui/primitives";

const PROFILE_URL = process.env.NEXT_PUBLIC_PROFILE_URL_TEMPLATE || "https://balkanza.com/profile/{id}";
const profileUrl = (id: string) => PROFILE_URL.replace("{id}", encodeURIComponent(id));

const TITLES: Record<string, string> = {
  verif_unverified: "Unverified users",
  verif_approved: "Verified (approved) users",
  verif_rejected: "Rejected verifications",
  verif_pending: "Pending verification",
  missing_gender: "Complete profiles — missing gender",
  missing_birthdate: "Complete profiles — missing birthdate",
  no_photo: "Complete profiles — no photo",
  bios_contact: "Bios containing contact info",
};

const VERIF_BADGE: Record<string, string> = {
  approved: "good",
  pending: "warn",
  rejected: "crit",
  unverified: "",
};

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { dateStyle: "medium" });
}

function SafetyUsersContent() {
  const sp = useSearchParams();
  const segment = sp.get("segment") || "";
  const params: Record<string, string> = {};
  (["segment", "days", "range", "from", "to", "asof"] as const).forEach((k) => {
    const v = sp.get(k);
    if (v) params[k] = v;
  });
  const { data, error, loading } = useMetrics<any>("safety-users", params);
  const showBio = segment === "bios_contact";

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="Balkanza" width={32} height={30} />
            <span className="brand-word">Balkanza</span>
            <span className="brand-divider" />
            <span className="brand-sub">Trust &amp; Safety</span>
          </a>
          <a className="logout-link" href="/#safety">← Back to dashboard</a>
        </div>
      </header>

      <div className="app">
        <div className="section">
          <div className="section-head">
            <div>
              <h2 className="section-title">{TITLES[segment] || "Users"}</h2>
              <p className="section-desc">
                {data ? (
                  <>
                    {fmtInt(data.rows.length)}{data.rows.length === 500 ? " (top 500)" : ""} user{data.rows.length === 1 ? "" : "s"} ·{" "}
                    {data.windowed ? <>window: <strong>{data.period.label}</strong></> : <strong>live · all users</strong>} · click a name to open the profile.
                  </>
                ) : (
                  "Loading…"
                )}
              </p>
            </div>
          </div>

          {error ? (
            <div className="callout crit"><span className="callout-icon">⚠️</span><div>{error}</div></div>
          ) : loading || !data ? (
            <div className="card"><p className="muted">Loading users…</p></div>
          ) : data.rows.length === 0 ? (
            <div className="card"><p className="muted">No users in this segment{data.windowed ? " for this window" : ""}.</p></div>
          ) : (
            <div className="card">
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Verification</th>
                      <th>Gender</th>
                      <th>Date of birth</th>
                      <th>Photo</th>
                      <th>Residence</th>
                      <th>Heritage</th>
                      {showBio && <th>Bio</th>}
                      <th>Last active</th>
                      <th>Signed up</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((u: any) => (
                      <tr key={u.id}>
                        <td>
                          <a href={profileUrl(u.id)} target="_blank" rel="noreferrer" className="match-user">
                            <strong>{u.name || u.email || u.id}</strong> ↗
                            {u.name && u.email ? <span className="muted"> · {u.email}</span> : null}
                          </a>
                        </td>
                        <td><span className={`badge ${VERIF_BADGE[u.verification] ?? ""}`}>{u.verification}</span></td>
                        <td className="muted">{u.gender}</td>
                        <td className="muted">{u.birthdate || "—"}</td>
                        <td>{u.hasPhoto ? <span className="badge good">Yes</span> : <span className="badge crit">No</span>}</td>
                        <td className="muted">{u.residence}</td>
                        <td className="muted">{u.heritage}</td>
                        {showBio && <td className="muted" style={{ maxWidth: 280 }}>{u.bio || "—"}</td>}
                        <td className="muted" title={fmtWhen(u.lastActive)}>{fmtAgo(u.lastActive)}</td>
                        <td className="muted" title={fmtWhen(u.createdAt)}>{fmtDate(u.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function SafetyUsersPage() {
  return (
    <Suspense fallback={<div className="app"><p className="muted" style={{ padding: 24 }}>Loading…</p></div>}>
      <SafetyUsersContent />
    </Suspense>
  );
}
