import { NextRequest, NextResponse } from "next/server";
import {
  getOverview,
  getGrowth,
  getFunnel,
  getEngagement,
  getLiquidity,
  getMonetization,
  getSafety,
} from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section") || "overview";
  const days = searchParams.get("days");

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "DATABASE_URL is not configured. Set it in your environment / Vercel project settings." },
      { status: 500 }
    );
  }

  try {
    let data: unknown;
    switch (section) {
      case "overview":
        data = await getOverview(days);
        break;
      case "growth":
        data = await getGrowth(days);
        break;
      case "funnel":
        data = await getFunnel(days);
        break;
      case "engagement":
        data = await getEngagement(days);
        break;
      case "liquidity":
        data = await getLiquidity(
          searchParams.get("min"),
          searchParams.get("limit"),
          searchParams.get("gender")
        );
        break;
      case "monetization":
        data = await getMonetization(days);
        break;
      case "safety":
        data = await getSafety(days);
        break;
      default:
        return NextResponse.json({ error: `Unknown section: ${section}` }, { status: 400 });
    }
    return NextResponse.json(
      { section, data, fetchedAt: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error(`[metrics] ${section} failed:`, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Query failed", section },
      { status: 500 }
    );
  }
}
