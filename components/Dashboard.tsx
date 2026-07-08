"use client";

import { useState } from "react";
import Overview from "./sections/Overview";
import Growth from "./sections/Growth";
import Funnel from "./sections/Funnel";
import Engagement from "./sections/Engagement";
import Liquidity from "./sections/Liquidity";
import Monetization from "./sections/Monetization";
import Safety from "./sections/Safety";

const NAV = [
  { id: "overview", label: "Overview" },
  { id: "growth", label: "Growth" },
  { id: "funnel", label: "Funnel" },
  { id: "engagement", label: "Engagement" },
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
          <div className="brand">
            <svg className="brand-logo" viewBox="0 0 32 32" role="img" aria-label="Balkanza">
              <defs>
                <linearGradient id="blk-mark" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="var(--brand-from)" />
                  <stop offset="1" stopColor="var(--brand-to)" />
                </linearGradient>
              </defs>
              <path
                fill="url(#blk-mark)"
                d="M16 29S3 21.2 3 12.1C3 7.6 6.4 4 10.6 4c2.6 0 4.6 1.3 5.4 3.2C16.8 5.3 18.8 4 21.4 4 25.6 4 29 7.6 29 12.1 29 21.2 16 29 16 29z"
              />
              <path
                fill="#fff"
                opacity="0.92"
                d="M13.6 10.4c2.6 0 4.2 1.3 4.2 3.4 0 1.3-.7 2.3-1.9 2.7 1.5.3 2.4 1.4 2.4 2.9 0 2.2-1.7 3.5-4.5 3.5h-4.2V10.4h4zM12 14.9h1.3c1 0 1.6-.5 1.6-1.4 0-.8-.6-1.3-1.6-1.3H12v2.7zm0 5h1.5c1.1 0 1.7-.5 1.7-1.5 0-.9-.6-1.4-1.8-1.4H12v2.9z"
              />
            </svg>
            <span className="brand-word">Balkanza</span>
            <span className="brand-divider" />
            <span className="brand-sub">Product Dashboard</span>
          </div>
          <div className="meta">
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
