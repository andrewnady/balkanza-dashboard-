import { NextRequest, NextResponse } from "next/server";
import { makeToken, SESSION_COOKIE } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const secret = process.env.AUTH_SECRET;
  const password = process.env.DASHBOARD_PASSWORD;

  // Not configured → protection off (site stays open until you set both env vars).
  if (!secret || !password) return NextResponse.next();

  const { pathname } = req.nextUrl;
  // The login page and auth endpoints must stay reachable while logged out.
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth/")) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const expected = await makeToken(secret);
  if (token && token === expected) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname === "/" ? "" : pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Protect everything except Next internals and the crawler files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)"],
};
