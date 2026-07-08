"use client";

import { useEffect, useState, useCallback } from "react";

/* ---------- formatters ---------- */
export const fmtInt = (n: number) => n.toLocaleString("en-US");
export const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n % 1 === 0 ? 0 : 2 });
export const fmtPct = (n: number) => `${(Math.round(n * 10) / 10).toLocaleString("en-US")}%`;

export function formatValue(v: number, format?: string) {
  if (format === "money") return fmtMoney(v);
  if (format === "pct") return fmtPct(v);
  return fmtInt(Math.round(v));
}

/* ---------- data fetching hook ---------- */
export function useMetrics<T = any>(section: string, params: Record<string, string | number> = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const qs = new URLSearchParams({ section, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) }).toString();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/metrics?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      setData(json.data);
      setFetchedAt(json.fetchedAt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, error, loading, fetchedAt, reload: load };
}

/* ---------- segmented control ---------- */
export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button
          key={String(o.value)}
          className={o.value === value ? "active" : ""}
          onClick={() => onChange(o.value)}
          role="tab"
          aria-selected={o.value === value}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- stat tile ---------- */
export function StatTile({
  label,
  value,
  prev,
  sub,
  format,
  goodDirection = "up",
}: {
  label: string;
  value: number;
  prev?: number | null;
  sub?: string;
  format?: string;
  goodDirection?: "up" | "down";
}) {
  let delta: React.ReactNode = null;
  if (prev !== null && prev !== undefined) {
    if (prev === 0 && value === 0) {
      delta = <span className="delta flat">–</span>;
    } else {
      const pct = prev === 0 ? 100 : ((value - prev) / prev) * 100;
      const rising = value >= prev;
      const good = goodDirection === "up" ? rising : !rising;
      delta = (
        <span className={`delta ${rising ? (good ? "up" : "down") : good ? "up" : "down"}`}>
          {rising ? "▲" : "▼"} {Math.abs(Math.round(pct * 10) / 10)}%
          <span className="muted" style={{ fontWeight: 500 }}>vs prev</span>
        </span>
      );
    }
  }
  return (
    <div className="card tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{formatValue(value, format)}</span>
      {delta ?? (sub ? <span className="tile-sub">{sub}</span> : null)}
      {delta && sub ? <span className="tile-sub">{sub}</span> : null}
    </div>
  );
}

/* ---------- section shell ---------- */
export function SectionHead({
  id,
  title,
  desc,
  children,
}: {
  id: string;
  title: string;
  desc?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        <h2 className="section-title" id={id}>
          {title}
        </h2>
        {desc && <p className="section-desc">{desc}</p>}
      </div>
      {children && <div className="filters">{children}</div>}
    </div>
  );
}

export function CardSkeleton({ height = 90 }: { height?: number }) {
  return <div className="skeleton" style={{ height }} />;
}

export function ErrorNote({ msg }: { msg: string }) {
  return <div className="card err">⚠ {msg}</div>;
}
