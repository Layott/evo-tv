import { NextResponse, type NextRequest } from "next/server";
import { listVods, listTrendingClips } from "@/lib/api/vods";
import { parseMaxRating, filterByMaxRating } from "@/lib/api/maturity";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const maxRating = parseMaxRating(searchParams.get("maxRating"));
  const trendingClips = searchParams.get("clips") === "trending";
  if (trendingClips) {
    const limit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
    return NextResponse.json(
      filterByMaxRating(await listTrendingClips(limit), maxRating),
    );
  }

  const gameId = searchParams.get("gameId") ?? undefined;
  const premiumStr = searchParams.get("isPremium");
  const isPremium = premiumStr === null ? undefined : premiumStr === "true";
  const limit = searchParams.get("limit")
    ? Number.parseInt(searchParams.get("limit")!, 10)
    : undefined;
  return NextResponse.json(
    filterByMaxRating(await listVods({ gameId, isPremium, limit }), maxRating),
  );
}
