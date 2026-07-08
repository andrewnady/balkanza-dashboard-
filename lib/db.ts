import { neon, neonConfig, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | null = null;
let configured = false;

/**
 * Lazily create the Neon client. Doing this on first query (not at module load)
 * means `next build` can collect page data without a DATABASE_URL — the value
 * only has to exist at request time (i.e. in the Vercel environment).
 */
function getClient(): NeonQueryFunction<false, false> {
  if (!configured) {
    const url = process.env.DATABASE_URL || "";
    if (!url) {
      throw new Error("DATABASE_URL is not configured. Set it in your Vercel project settings.");
    }
    // Route SQL-over-HTTP straight at the connection host (the Neon pooler endpoint)
    // rather than a derived `api.<region>` host — one hostname, identical on Vercel.
    try {
      const host = new URL(url).host;
      if (host) neonConfig.fetchEndpoint = () => `https://${host}/sql`;
    } catch {
      /* invalid URL — surfaced by neon() below */
    }
    client = neon(url);
    configured = true;
  }
  return client!;
}

/**
 * Tagged-template proxy over the lazy client. Usage is unchanged: `await sql`...``.
 * Nothing connects until a query actually runs.
 */
export const sql = ((strings: TemplateStringsArray, ...values: unknown[]) =>
  getClient()(strings, ...(values as any[]))) as unknown as NeonQueryFunction<false, false>;

/** Whitelist a day-window so it can be safely used in interval math. */
export function clampDays(input: unknown, allowed: number[] = [7, 14, 30, 90], fallback = 30): number {
  const n = Number(input);
  return allowed.includes(n) ? n : fallback;
}
