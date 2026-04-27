import { NextResponse, type NextRequest } from "next/server";
import { listVods, listTrendingClips } from "@/lib/api/vods";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trendingClips = searchParams.get("clips") === "trending";
  if (trendingClips) {
    const limit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
    return NextResponse.json(await listTrendingClips(limit));
  }

  const gameId = searchParams.get("gameId") ?? undefined;
  const premiumStr = searchParams.get("isPremium");
  const isPremium = premiumStr === null ? undefined : premiumStr === "true";
  const limit = searchParams.get("limit")
    ? Number.parseInt(searchParams.get("limit")!, 10)
    : undefined;
  return NextResponse.json(await listVods({ gameId, isPremium, limit }));
}
