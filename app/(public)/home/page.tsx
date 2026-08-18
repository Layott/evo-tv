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
import { useAuth } from "@/components/providers";
import { MainChannelHero } from "@/components/home/main-channel";
import HeroCarousel from "@/components/home/hero-carousel";
import LiveNow from "@/components/home/live-now-section";
import UpcomingEvents from "@/components/home/upcoming-events-section";
import TrendingClips from "@/components/home/trending-clips-section";
import AdBanner from "@/components/home/ad-banner";
import Recommendations from "@/components/home/recommendations";

export default function HomePage() {
  const { role, isPremium } = useAuth();

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
    enabled: isPremium,
  });

  /*
   * The flagship appears once.
   *
   * It has prime position at the top of this page, and it was also arriving in
   * the featured carousel and the Live now rail, so the same channel was on
   * screen three times before a viewer had scrolled. Filtering here rather than
   * in the endpoints keeps those lists correct for every other page that uses
   * them: the channel genuinely is live and genuinely is featured, it just does
   * not need saying three times in one column.
   */
  const withoutFlagship = <T extends { isMainChannel?: boolean }>(rows: T[]) =>
    rows.filter((s) => !s.isMainChannel);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      {/* Fixed prime position. The channel comes before the catalogue, and
          stays put whether or not it is broadcasting. */}
      <MainChannelHero />

      <HeroCarousel streams={withoutFlagship(featured.data ?? [])} />

      {!isPremium && <AdBanner />}

      <LiveNow
        streams={withoutFlagship(live.data ?? [])}
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

      {isPremium && (
        <Recommendations
          vods={recs.data ?? []}
          games={games.data ?? []}
          loading={recs.isPending}
        />
      )}
    </div>
  );
}
