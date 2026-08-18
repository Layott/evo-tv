import { NextResponse, type NextRequest } from "next/server";
import { listVods, listTrendingClips } from "@/lib/api/vods";
import { parseMaxRating, filterByMaxRating } from "@/lib/api/maturity";
import { resolveViewer, stripVodPlaybackAll } from "@/lib/api/playback";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // Resolved once for the whole list rather than per row: it costs a query.
  const viewer = await resolveViewer();
  const maxRating = parseMaxRating(searchParams.get("maxRating"));
  const trendingClips = searchParams.get("clips") === "trending";
  if (trendingClips) {
    const limit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
    return NextResponse.json(
      // Clips are deliberately untouched. They carry no `isPremium` and no
      // manifest, only a short mp4 of a highlight, so there is no paywall here
      // to enforce and stripping them would break sharing for no gain.
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
    stripVodPlaybackAll(
      filterByMaxRating(await listVods({ gameId, isPremium, limit }), maxRating),
      viewer,
    ),
  );
}
