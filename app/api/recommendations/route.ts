import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { recommendForUser } from "@/lib/recommendations";
import { trendingVods } from "@/lib/recommendations/trending";
import { resolveViewer, stripVodPlaybackAll } from "@/lib/api/playback";
import { stripViewCountAll } from "@/lib/api/counts";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limitRaw = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 100 ? limitRaw : 20;

  const user = await getCurrentUser();
  // Recommendations carry the same playback URLs as the VOD detail route, so
  // they need the same gate. Otherwise the paywall is bypassed by asking for
  // suggestions rather than for the video.
  const viewer = await resolveViewer();

  if (!user) {
    const items = await trendingVods(limit);
    return NextResponse.json({ items: stripViewCountAll(stripVodPlaybackAll(items, viewer), viewer.admin), source: "trending" as const });
  }

  const items = await recommendForUser(user.id, limit);
  if (items.length === 0) {
    const fallback = await trendingVods(limit);
    return NextResponse.json({ items: stripViewCountAll(stripVodPlaybackAll(fallback, viewer), viewer.admin), source: "trending" as const });
  }
  return NextResponse.json({ items: stripViewCountAll(stripVodPlaybackAll(items, viewer), viewer.admin), source: "personalized" as const });
}
