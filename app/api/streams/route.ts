import { NextResponse, type NextRequest } from "next/server";
import { listLiveStreams, listFeaturedStreams } from "@/lib/api/streams";
import { parseMaxRating, filterByMaxRating } from "@/lib/api/maturity";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const maxRating = parseMaxRating(searchParams.get("maxRating"));
  const featured = searchParams.get("featured") === "1";
  if (featured) {
    return NextResponse.json(
      filterByMaxRating(await listFeaturedStreams(), maxRating),
    );
  }

  const gameId = searchParams.get("gameId") ?? undefined;
  const premiumStr = searchParams.get("isPremium");
  const isPremium = premiumStr === null ? undefined : premiumStr === "true";
  return NextResponse.json(
    filterByMaxRating(await listLiveStreams({ gameId, isPremium }), maxRating),
  );
}
