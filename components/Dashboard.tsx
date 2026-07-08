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
            <div className="brand-mark">B</div>
            <div>
              <div className="brand-title">Balkanza</div>
              <div className="brand-sub">Product & Growth Dashboard</div>
            </div>
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
