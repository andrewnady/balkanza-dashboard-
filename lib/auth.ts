// Minimal shared-password session: the session cookie holds an HMAC of a fixed
// marker keyed by AUTH_SECRET. Nothing secret is exposed to the client (cookie is
// httpOnly), and the value can't be forged without AUTH_SECRET. Works in both the
// Edge middleware and Node route handlers via Web Crypto.

export const SESSION_COOKIE = "bkz_session";

const enc = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += b[i].toString(16).padStart(2, "0");
  return s;
}

export async function makeToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("balkanza-authorized-v1"));
  return toHex(sig);
}

/** Auth is only enforced when both env vars are set — keeps the site open until configured. */
export function authConfigured(): boolean {
  return Boolean(process.env.AUTH_SECRET && process.env.DASHBOARD_PASSWORD);
}
