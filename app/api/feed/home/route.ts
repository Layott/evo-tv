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
    hero: stripPlaybackAll(hero, viewer.signedIn),
    live: stripPlaybackAll(live, viewer.signedIn),
    upcoming,
    recommendations: stripVodPlaybackAll(recommendations, viewer),
    // Clips carry no paywall and no manifest, only a short highlight mp4.
    trendingClips,
  });
}
