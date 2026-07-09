/**
 * Resolves a section's time filter into concrete date bounds.
 *
 * The business day rolls over at DAY_START_HOUR UTC (03:00), not midnight — so
 * "Today" means [today 03:00 UTC, tomorrow 03:00 UTC) and a timestamp before
 * 03:00 belongs to the previous logical day.
 *
 * Accepts (from the query string):
 *   - days=N        preset rolling window (N=1 means today)
 *   - range=all     all time
 *   - from & to     custom inclusive range (YYYY-MM-DD, interpreted as logical days)
 *
 * Downstream: use `start`/`endEx` (timestamptz ISO strings, 03:00-anchored) for
 * timestamptz columns, and `startDate`/`endExDate` (YYYY-MM-DD) for date columns.
 */

export const DAY_START_HOUR = 0; // logical day starts at midnight UTC

export type PeriodInput = { days?: unknown; range?: unknown; from?: unknown; to?: unknown; asof?: unknown };

export interface Period {
  mode: "days" | "all" | "custom";
  days: number;
  start: string; // inclusive timestamptz (YYYY-MM-DDT03:00:00Z)
  endEx: string; // exclusive timestamptz
  startDate: string; // inclusive logical date (for date-typed columns)
  endExDate: string; // exclusive logical date
  hasPrev: boolean;
  prevStart: string;
  prevEndEx: string;
  label: string;
  prevLabel: string;
}

const ALL_TIME_START_TS = "2000-01-01T00:00:00Z";
const ALL_TIME_START_DATE = "2000-01-01";
const HH = String(DAY_START_HOUR).padStart(2, "0");

/** Timestamptz for the start (03:00 UTC) of a logical date. */
function tsAt(dateIso: string): string {
  return `${dateIso}T${HH}:00:00Z`;
}

/** The current logical date — shifted back by the day-start offset so it rolls at 03:00. */
function logicalToday(): string {
  return new Date(Date.now() - DAY_START_HOUR * 3600_000).toISOString().slice(0, 10);
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

// Cap the (future-reaching) upper bound at the page snapshot instant so the
// current, still-accumulating period is frozen and consistent across the page.
function capAsof(endEx: string, asof: unknown): string {
  if (typeof asof === "string" && /^\d{4}-\d{2}-\d{2}T/.test(asof) && !Number.isNaN(Date.parse(asof))) {
    if (Date.parse(asof) < Date.parse(endEx)) return asof;
  }
  return endEx;
}

export function resolvePeriod(input: PeriodInput, allowed: number[], fallback: number): Period {
  const today = logicalToday();
  const endTodayDate = addDays(today, 1); // exclusive upper bound (tomorrow's logical start)

  // All time
  if (String(input.range) === "all") {
    return {
      mode: "all",
      days: daysBetween(ALL_TIME_START_DATE, endTodayDate),
      start: ALL_TIME_START_TS,
      endEx: capAsof(tsAt(endTodayDate), input.asof),
      startDate: ALL_TIME_START_DATE,
      endExDate: endTodayDate,
      hasPrev: false,
      prevStart: ALL_TIME_START_TS,
      prevEndEx: ALL_TIME_START_TS,
      label: "all time",
      prevLabel: "—",
    };
  }

  // Custom range (inclusive calendar dates, interpreted as logical days)
  if (isValidDate(input.from) && isValidDate(input.to) && input.from <= input.to) {
    const startDate = input.from;
    const endExDate = addDays(input.to, 1);
    const len = daysBetween(startDate, endExDate);
    const prevStartDate = addDays(startDate, -len);
    return {
      mode: "custom",
      days: len,
      start: tsAt(startDate),
      endEx: capAsof(tsAt(endExDate), input.asof),
      startDate,
      endExDate,
      hasPrev: true,
      prevStart: tsAt(prevStartDate),
      prevEndEx: tsAt(startDate),
      label: `${input.from} → ${input.to}`,
      prevLabel: `prev ${len}d`,
    };
  }

  // Preset rolling window
  const days = allowed.includes(Number(input.days)) ? Number(input.days) : fallback;
  const startDate = addDays(today, -(days - 1));
  const prevStartDate = addDays(today, -(2 * days - 1));
  const prevEndExDate = addDays(today, -(days - 1));
  return {
    mode: "days",
    days,
    start: tsAt(startDate),
    endEx: tsAt(endTodayDate),
    startDate,
    endExDate: endTodayDate,
    hasPrev: true,
    prevStart: tsAt(prevStartDate),
    prevEndEx: tsAt(prevEndExDate),
    label: days === 1 ? "today" : `last ${days} days`,
    prevLabel: days === 1 ? "yesterday" : `prev ${days}d`,
  };
}
