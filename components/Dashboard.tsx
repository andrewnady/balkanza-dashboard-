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
            <svg className="brand-logo" viewBox="0 0 32 32" fill="none" role="img" aria-label="Balkanza">
              <defs>
                <linearGradient id="blk-mark" x1="4" y1="6" x2="28" y2="26" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#e0173c" />
                  <stop offset="1" stopColor="#e8384f" />
                </linearGradient>
              </defs>
              <path
                d="M16 26.5C12.2 22.9 6.7 19.2 6.7 13.4c0-3.2 2.3-5.4 5.1-5.4 2.4 0 3.9 1.6 4.2 3.7.3-2.1 1.8-3.7 4.2-3.7 2.8 0 5.1 2.2 5.1 5.4 0 5.8-5.5 9.5-9.3 13.1z"
                stroke="url(#blk-mark)"
                strokeWidth="3.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12.1 15.1c-1.7.2-3-.9-3-2.6 0-1.6 1.2-2.7 2.7-2.7"
                stroke="url(#blk-mark)"
                strokeWidth="3.1"
                strokeLinecap="round"
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
