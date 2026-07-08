/**
 * Resolves a section's time filter into concrete date bounds.
 *
 * Accepts (from the query string):
 *   - days=N        preset rolling window (calendar-day based; N=1 means today)
 *   - range=all     all time
 *   - from & to     custom inclusive range (YYYY-MM-DD)
 *
 * Everything downstream works off `start`/`endEx` (a half-open [start, endEx)
 * interval) plus the equal-length previous window for period-over-period deltas.
 * All dates are UTC to match the database's CURRENT_DATE.
 */

export type PeriodInput = { days?: unknown; range?: unknown; from?: unknown; to?: unknown };

export interface Period {
  mode: "days" | "all" | "custom";
  days: number; // window length in days (used for labels / fallbacks)
  start: string; // inclusive YYYY-MM-DD
  endEx: string; // exclusive YYYY-MM-DD (day after the last day in range)
  hasPrev: boolean; // is a previous comparison window meaningful?
  prevStart: string;
  prevEndEx: string;
  label: string; // e.g. "today", "last 7 days", "all time", "2026-06-01 → 2026-06-30"
  prevLabel: string; // e.g. "yesterday", "prev 7d"
}

const ALL_TIME_START = "2000-01-01";

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(aIso: string, bIso: string): number {
  return Math.round((Date.parse(bIso) - Date.parse(aIso)) / 86400000);
}

function isValidDate(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
}

export function resolvePeriod(input: PeriodInput, allowed: number[], fallback: number): Period {
  const today = todayUTC();
  const endToday = addDays(today, 1); // exclusive upper bound covering all of today

  // All time
  if (String(input.range) === "all") {
    return {
      mode: "all",
      days: daysBetween(ALL_TIME_START, endToday),
      start: ALL_TIME_START,
      endEx: endToday,
      hasPrev: false,
      prevStart: ALL_TIME_START,
      prevEndEx: ALL_TIME_START,
      label: "all time",
      prevLabel: "—",
    };
  }

  // Custom range
  if (isValidDate(input.from) && isValidDate(input.to) && input.from <= input.to) {
    const start = input.from;
    const endEx = addDays(input.to, 1);
    const len = daysBetween(start, endEx);
    return {
      mode: "custom",
      days: len,
      start,
      endEx,
      hasPrev: true,
      prevStart: addDays(start, -len),
      prevEndEx: start,
      label: `${input.from} → ${input.to}`,
      prevLabel: `prev ${len}d`,
    };
  }

  // Preset rolling window
  const days = allowed.includes(Number(input.days)) ? Number(input.days) : fallback;
  return {
    mode: "days",
    days,
    start: addDays(today, -(days - 1)),
    endEx: endToday,
    hasPrev: true,
    prevStart: addDays(today, -(2 * days - 1)),
    prevEndEx: addDays(today, -(days - 1)),
    label: days === 1 ? "today" : `last ${days} days`,
    prevLabel: days === 1 ? "yesterday" : `prev ${days}d`,
  };
}
