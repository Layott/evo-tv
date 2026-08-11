import { NextResponse, type NextRequest } from "next/server";
import { listLiveStreams, listFeaturedStreams } from "@/lib/api/streams";
import { parseMaxRating, filterByMaxRating } from "@/lib/api/maturity";
import { getCurrentUser } from "@/lib/auth/guards";
import { stripPlaybackAll } from "@/lib/api/playback";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // The list leaks just as effectively as the detail route if it carries the
  // manifest URL, so both go through the same gate.
  const signedIn = Boolean(await getCurrentUser());
  const maxRating = parseMaxRating(searchParams.get("maxRating"));
  const featured = searchParams.get("featured") === "1";
  if (featured) {
    return NextResponse.json(
      stripPlaybackAll(
        filterByMaxRating(await listFeaturedStreams(), maxRating),
        signedIn,
      ),
    );
  }

  const gameId = searchParams.get("gameId") ?? undefined;
  const premiumStr = searchParams.get("isPremium");
  const isPremium = premiumStr === null ? undefined : premiumStr === "true";
  return NextResponse.json(
    stripPlaybackAll(
      filterByMaxRating(await listLiveStreams({ gameId, isPremium }), maxRating),
      signedIn,
    ),
  );
}
