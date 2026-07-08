import { neon, neonConfig } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL || "";

if (!url) {
  // Surfaced clearly at request time instead of a cryptic driver error.
  console.warn("DATABASE_URL is not set. API routes will return an error.");
}

// Route SQL-over-HTTP straight at the connection host (the Neon pooler endpoint)
// rather than letting the driver derive a separate `api.<region>` host. This keeps
// all traffic on one hostname — simpler to allowlist and identical behaviour on Vercel.
try {
  const host = new URL(url).host;
  if (host) neonConfig.fetchEndpoint = () => `https://${host}/sql`;
} catch {
  /* invalid or empty URL — handled at request time */
}

// Neon's HTTP driver — perfect for Vercel serverless functions. Read-only user.
export const sql = neon(url);

/** Whitelist a day-window so it can be safely used in interval math. */
export function clampDays(input: unknown, allowed: number[] = [7, 14, 30, 90], fallback = 30): number {
  const n = Number(input);
  return allowed.includes(n) ? n : fallback;
}
