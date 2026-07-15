"use client";

import { useState } from "react";
import Overview from "./sections/Overview";
import Growth from "./sections/Growth";
import Funnel from "./sections/Funnel";
import Engagement from "./sections/Engagement";
import Discovery from "./sections/Discovery";
import Diagnostics from "./sections/Diagnostics";
import Liquidity from "./sections/Liquidity";
import Monetization from "./sections/Monetization";
import Safety from "./sections/Safety";

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "growth", label: "Growth" },
  { id: "funnel", label: "Funnel" },
  { id: "engagement", label: "Engagement" },
  { id: "discovery", label: "Discovery" },
  { id: "diagnostics", label: "Diagnostics" },
  { id: "liquidity", label: "Liquidity" },
  { id: "monetization", label: "Monetization" },
  { id: "safety", label: "Trust & Safety" },
];

export default function Dashboard() {
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="/" aria-label="Balkanza home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.svg" alt="Balkanza" width={32} height={30} />
            <span className="brand-word">Balkanza</span>
            <span className="brand-divider" />
            <span className="brand-sub">Product Dashboard</span>
          </a>
          <div className="meta" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span>
              {fetchedAt ? (
                <>
                  Live from production ·{" "}
                  <strong>
                    {new Date(fetchedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  </strong>
                </>
              ) : (
                "Connecting…"
              )}
            </span>
            <button className="refresh-btn" onClick={() => window.location.reload()} title="Reload the latest data">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
              Refresh
            </button>
            <button
              className="logout-link"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="app">
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`}>
              {n.label}
            </a>
          ))}
        </nav>

        <Overview onFetched={setFetchedAt} />
        <Growth />
        <Funnel />
        <Engagement />
        <Discovery />
        <Diagnostics />
        <Liquidity />
        <Monetization />
        <Safety />

        <footer className="footer">
          Balkanza product dashboard · data read live from the production read-replica · all metrics in UTC.
          <br />
          Filters on each section are independent — change a window without affecting the others.
        </footer>
      </div>
    </>
  );
}
