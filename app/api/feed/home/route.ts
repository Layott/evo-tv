import { NextResponse } from "next/server";
import { listFeaturedStreams, listLiveStreams } from "@/lib/api/streams";
import { listEvents } from "@/lib/api/events";
import { listTrendingClips } from "@/lib/api/vods";
import { getCurrentUser } from "@/lib/auth/guards";
import { recommendForUser } from "@/lib/recommendations";
import { trendingVods } from "@/lib/recommendations/trending";
import {
  resolveViewer,
  stripPlaybackAll,
  stripVodPlaybackAll,
} from "@/lib/api/playback";
import {
  stripViewCountAll,
  stripViewerCountAll,
} from "@/lib/api/counts";

/**
 * GET /api/feed/home
 *
 * The home screen in one request.
 *
 * Playback URLs are stripped here for the same reason they are on the endpoints
 * that return a single stream or VOD: this route was returning live manifests
 * and premium video URLs to anybody who asked, so the sign-in wall and the
 * paywall could both be walked around from the network tab of the home page,
 * without even visiting the thing being protected.
 */
export async function GET() {
  const user = await getCurrentUser();
  // One resolution for the whole payload; it reads the subscription.
  const viewer = await resolveViewer();

  const [hero, live, upcoming, trendingClips] = await Promise.all([
    listFeaturedStreams(),
    listLiveStreams(),
    listEvents({ status: "scheduled" }),
    listTrendingClips(10),
  ]);

  const recommendations = user
    ? await recommendForUser(user.id, 20)
    : await trendingVods(20);

  return NextResponse.json({
    hero: stripViewerCountAll(stripPlaybackAll(hero, viewer), viewer.admin),
    live: stripViewerCountAll(stripPlaybackAll(live, viewer), viewer.admin),
    upcoming,
    recommendations: stripViewCountAll(
      stripVodPlaybackAll(recommendations, viewer),
      viewer.admin,
    ),
    // Clips carry no paywall and no manifest, only a short highlight mp4, but
    // their play count is an audience number like any other.
    trendingClips: stripViewCountAll(trendingClips, viewer.admin),
  });
}
