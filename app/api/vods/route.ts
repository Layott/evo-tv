import { NextResponse, type NextRequest } from "next/server";
import { listVods, listTrendingClips } from "@/lib/api/vods";
import { parseMaxRating, filterByMaxRating } from "@/lib/api/maturity";
import { resolveViewer, stripVodPlaybackAll } from "@/lib/api/playback";
import { stripViewCountAll } from "@/lib/api/counts";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // Resolved once for the whole list rather than per row: it costs a query.
  const viewer = await resolveViewer();
  const maxRating = parseMaxRating(searchParams.get("maxRating"));
  const trendingClips = searchParams.get("clips") === "trending";
  if (trendingClips) {
    const limit = Number.parseInt(searchParams.get("limit") ?? "10", 10);
    return NextResponse.json(
      // No paywall on a clip: no `isPremium`, no manifest, just a short mp4
      // of a highlight. The play count is stripped all the same, because that
      // is an audience number and those are staff only.
      stripViewCountAll(
        filterByMaxRating(await listTrendingClips(limit), maxRating),
        viewer.admin,
      ),
    );
  }

  const gameId = searchParams.get("gameId") ?? undefined;
  const premiumStr = searchParams.get("isPremium");
  const isPremium = premiumStr === null ? undefined : premiumStr === "true";
  const limit = searchParams.get("limit")
    ? Number.parseInt(searchParams.get("limit")!, 10)
    : undefined;
  return NextResponse.json(
    stripViewCountAll(
      stripVodPlaybackAll(
        filterByMaxRating(await listVods({ gameId, isPremium, limit }), maxRating),
        viewer,
      ),
      viewer.admin,
    ),
  );
}
