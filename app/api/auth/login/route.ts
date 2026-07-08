import { NextRequest, NextResponse } from "next/server";
import { makeToken, SESSION_COOKIE } from "../../../../lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  const password = process.env.DASHBOARD_PASSWORD;

  // Protection disabled — treat any attempt as success so /login still works.
  if (!secret || !password) return NextResponse.json({ ok: true, disabled: true });

  const body = await req.json().catch(() => ({}));
  if (typeof body?.password !== "string" || body.password !== password) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await makeToken(secret), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}
