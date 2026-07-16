import { NextRequest, NextResponse } from "next/server";
import {
  getOverview,
  getGrowth,
  getFunnel,
  getEngagement,
  getLiquidity,
  getMonetization,
  getSafety,
  getDiagnostics,
  getMatches,
  getUsers,
  getSubscribers,
  getRetentionUsers,
  getIcebreakers,
  getBuyers,
  getCancellations,
  getSafetyUsers,
  getCompletionInsights,
  getIncompleteUsers,
  getViewsBoosts,
  getMarketplace,
  getConversationFunnel,
  getRetentionCohorts,
  getRevenueHealth,
  getReengagement,
  getNewUserActivation,
} from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Neon's driver talks over fetch(), which Next caches by default — that made
// different sections read stale, mismatched counts. Force every query fresh.
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const section = searchParams.get("section") || "overview";
  const period = {
    days: searchParams.get("days"),
    range: searchParams.get("range"),
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    asof: searchParams.get("asof"),
  };

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
        data = await getOverview(period);
        break;
      case "growth":
        data = await getGrowth(period);
        break;
      case "funnel":
        data = await getFunnel(period);
        break;
      case "engagement":
        data = await getEngagement(period);
        break;
      case "liquidity":
        data = await getLiquidity(
          searchParams.get("min"),
          searchParams.get("limit"),
          searchParams.get("gender")
        );
        break;
      case "monetization":
        data = await getMonetization(period);
        break;
      case "safety":
        data = await getSafety(period);
        break;
      case "diagnostics":
        data = await getDiagnostics();
        break;
      case "matches":
        data = await getMatches(period, searchParams.get("type"));
        break;
      case "users":
        data = await getUsers(period, searchParams.get("type"));
        break;
      case "subscribers":
        data = await getSubscribers(searchParams.get("name"), searchParams.get("price"), searchParams.get("duration"));
        break;
      case "retention":
        data = await getRetentionUsers(searchParams.get("segment"));
        break;
      case "icebreakers":
        data = await getIcebreakers();
        break;
      case "buyers":
        data = await getBuyers(period, searchParams.get("type"));
        break;
      case "cancellations":
        data = await getCancellations(period, searchParams.get("scope"));
        break;
      case "safety-users":
        data = await getSafetyUsers(period, searchParams.get("segment"));
        break;
      case "completion-insights":
        data = await getCompletionInsights();
        break;
      case "incomplete-users":
        data = await getIncompleteUsers(searchParams.get("step"));
        break;
      case "views-boosts":
        data = await getViewsBoosts(period);
        break;
      case "marketplace":
        data = await getMarketplace();
        break;
      case "conversations":
        data = await getConversationFunnel();
        break;
      case "retention-cohorts":
        data = await getRetentionCohorts();
        break;
      case "revenue-health":
        data = await getRevenueHealth();
        break;
      case "reengagement":
        data = await getReengagement();
        break;
      case "new-user-activation":
        data = await getNewUserActivation();
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
