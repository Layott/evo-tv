"use client";

import { useQuery } from "@tanstack/react-query";
import {
  listFeaturedStreams,
  listLiveStreams,
  listEvents,
  listGames,
  listTrendingClips,
  listVods,
} from "@/lib/client";
import { useMockAuth } from "@/components/providers";
import HeroCarousel from "@/components/home/hero-carousel";
import LiveNow from "@/components/home/live-now-section";
import UpcomingEvents from "@/components/home/upcoming-events-section";
import TrendingClips from "@/components/home/trending-clips-section";
import AdBanner from "@/components/home/ad-banner";
import Recommendations from "@/components/home/recommendations";

export default function HomePage() {
  const { role } = useMockAuth();

  const featured = useQuery({
    queryKey: ["streams", "featured"],
    queryFn: () => listFeaturedStreams(),
  });

  const live = useQuery({
    queryKey: ["streams", "live"],
    queryFn: () => listLiveStreams({ isPremium: false }),
  });

  const upcoming = useQuery({
    queryKey: ["events", "scheduled"],
    queryFn: () => listEvents({ status: "scheduled" }),
  });

  const games = useQuery({
    queryKey: ["games"],
    queryFn: () => listGames(),
  });

  const clips = useQuery({
    queryKey: ["clips", "trending"],
    queryFn: () => listTrendingClips(10),
  });

  const recs = useQuery({
    queryKey: ["vods", "recommendations"],
    queryFn: () => listVods({ limit: 8 }),
    enabled: role === "premium",
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      <HeroCarousel streams={featured.data ?? []} />

      {role !== "premium" && <AdBanner />}

      <LiveNow
        streams={live.data ?? []}
        games={games.data ?? []}
        loading={live.isPending || games.isPending}
      />

      <UpcomingEvents
        events={(upcoming.data ?? []).slice(0, 10)}
        games={games.data ?? []}
        loading={upcoming.isPending || games.isPending}
      />

      <TrendingClips
        clips={clips.data ?? []}
        loading={clips.isPending}
      />

      {role === "premium" && (
        <Recommendations
          vods={recs.data ?? []}
          games={games.data ?? []}
          loading={recs.isPending}
        />
      )}
    </div>
  );
}
