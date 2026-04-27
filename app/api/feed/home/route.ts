import { NextResponse } from "next/server";
import { listFeaturedStreams, listLiveStreams } from "@/lib/api/streams";
import { listEvents } from "@/lib/api/events";
import { listTrendingClips } from "@/lib/api/vods";
import { getCurrentUser } from "@/lib/auth/guards";
import { recommendForUser } from "@/lib/recommendations";
import { trendingVods } from "@/lib/recommendations/trending";

export async function GET() {
  const user = await getCurrentUser();

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
    hero,
    live,
    upcoming,
    recommendations,
    trendingClips,
  });
}
