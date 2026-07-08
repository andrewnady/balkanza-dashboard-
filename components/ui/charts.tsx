"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";

const AXIS = "var(--text-muted)";
const GRID = "var(--grid)";

function TooltipBox({ active, payload, label, valueFmt }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border-strong)",
        borderRadius: 10,
        padding: "8px 11px",
        boxShadow: "var(--shadow)",
        fontSize: 12.5,
      }}
    >
      {label !== undefined && <div style={{ color: "var(--text-muted)", marginBottom: 4 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, color: "var(--text-primary)" }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: p.color || p.fill }} />
          <span style={{ color: "var(--text-secondary)" }}>{p.name}:</span>
          <strong style={{ fontVariantNumeric: "tabular-nums" }}>
            {valueFmt ? valueFmt(p.value) : p.value?.toLocaleString?.() ?? p.value}
          </strong>
        </div>
      ))}
    </div>
  );
}

/* ---- single-series trend (area) ---- */
export function TrendArea({
  data,
  xKey,
  yKey,
  color = "var(--series-1)",
  height = 220,
  valueFmt,
}: {
  data: any[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  valueFmt?: (v: number) => string;
}) {
  const gid = `g-${yKey}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
        <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
        <Tooltip content={<TooltipBox valueFmt={valueFmt} />} />
        <Area type="monotone" dataKey={yKey} name={yKey} stroke={color} strokeWidth={2} fill={`url(#${gid})`} dot={false} activeDot={{ r: 4 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ---- line (single series, e.g. completion %) ---- */
export function TrendLine({
  data,
  xKey,
  yKey,
  color = "var(--series-2)",
  height = 220,
  valueFmt,
  domain,
}: {
  data: any[];
  xKey: string;
  yKey: string;
  color?: string;
  height?: number;
  valueFmt?: (v: number) => string;
  domain?: [number, number];
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={24} />
        <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={44} domain={domain} />
        <Tooltip content={<TooltipBox valueFmt={valueFmt} />} />
        <Line type="monotone" dataKey={yKey} name={yKey} stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ---- horizontal bars (funnel / rankings) ---- */
export function HBars({
  data,
  labelKey,
  valueKey,
  colors,
  height,
  valueFmt,
  showLabels = true,
}: {
  data: any[];
  labelKey: string;
  valueKey: string;
  colors?: string[];
  height?: number;
  valueFmt?: (v: number) => string;
  showLabels?: boolean;
}) {
  const h = height ?? Math.max(120, data.length * 46 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart layout="vertical" data={data} margin={{ top: 2, right: 44, left: 8, bottom: 2 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey={labelKey}
          tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={140}
        />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<TooltipBox valueFmt={valueFmt} />} />
        <Bar dataKey={valueKey} name={valueKey} radius={[0, 5, 5, 0]} barSize={22}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors ? colors[i % colors.length] : "var(--series-1)"} />
          ))}
          {showLabels && (
            <LabelList
              dataKey={valueKey}
              position="right"
              formatter={(v: number) => (valueFmt ? valueFmt(v) : v.toLocaleString())}
              style={{ fill: "var(--text-secondary)", fontSize: 12, fontWeight: 600 }}
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---- grouped bars (2 series, e.g. men vs women) ---- */
export function GroupedBars({
  data,
  labelKey,
  series,
  height = 300,
}: {
  data: any[];
  labelKey: string;
  series: { key: string; name: string; color: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={labelKey} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={{ stroke: GRID }} interval={0} angle={-30} textAnchor="end" height={54} />
        <YAxis tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
        <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<TooltipBox />} />
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[4, 4, 0, 0]} barSize={14} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export const SERIES = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
];
