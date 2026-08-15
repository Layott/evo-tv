import type { Metadata } from "next";

import { getNowAndNext, getSchedule } from "@/lib/api/epg";
import { originalShows } from "@/lib/epg/artwork";
import type { EpgPillar } from "@/lib/epg/grid";
import Hero from "@/components/landing/hero";
import Originals from "@/components/landing/originals";
import PillarsSection from "@/components/landing/pillars-section";
import SiteFooter from "@/components/landing/site-footer";
import SiteHeader from "@/components/landing/site-header";
import VideoOpening from "@/components/landing/video-opening";
import Week from "@/components/landing/week";

/**
 * The guest root of evotv.co.
 *
 * A server component on purpose. This used to be a client splash that animated
 * for 2.5 seconds and then pushed to /home or /login - app behaviour, not
 * website behaviour, and a visitor arriving from search should not watch a
 * loading bar. Signed-in users never reach it: `proxy.ts` redirects `/` to
 * `/home` before render.
 */

export const metadata: Metadata = {
  title: "EVO TV. Africa's home for esports, anime and lifestyle.",
  description:
    "One channel, always on. League nights, watch-alongs and the creators around them, streaming 24/7 from Lagos.",
  alternates: { canonical: "/" },
};

/**
 * Rendered per request, not prerendered at build.
 *
 * This was `export const revalidate = 60`, which makes it an ISR page, and Next
 * prerenders ISR pages during `next build`. The build runs inside Docker with
 * no database reachable, so `pnpm build` died with ECONNREFUSED on
 * 127.0.0.1:5432 and the image could not be produced at all. It only surfaced
 * on the droplet because a local build has `.env.local` and a reachable
 * Postgres.
 *
 * Prerendering was the wrong model regardless: the page leads with what is on
 * air right now, and baking that into the image at build time would ship a
 * schedule that was already stale on first request.
 *
 * The queries behind it are two reads over `epg_slots`, which is 168 rows, so
 * per-request rendering is cheap. If landing traffic ever makes that matter,
 * cache the data layer rather than the page: `unstable_cache` keyed on the
 * channel-local date, so the grid is shared and only the on-air marker moves.
 */
export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const [week, nowNext] = await Promise.all([
    getSchedule(new Date(), 7),
    getNowAndNext(),
  ]);


  // Hours per pillar are counted off the grid rather than typed into the copy,
  // so the page cannot claim programming the channel does not have.
  const weekHours: Record<EpgPillar, number> = { esports: 0, anime: 0, lifestyle: 0 };
  for (const day of week) {
    for (const entry of day.entries) {
      weekHours[entry.pillar] += entry.durationMin / 60;
    }
  }

  // Running order for the ticker: what is still to come today, then tomorrow.
  const nowIso = new Date().toISOString();
  const upcoming = week
    .slice(0, 2)
    .flatMap((d) => d.entries)
    .filter((e) => e.endsAt > nowIso)
    .slice(0, 14);

  return (
    <div
      className="landing-root landing-grain relative min-h-screen selection:bg-[var(--brand)] selection:text-[var(--ink)]"
    >
      {/* Outside the hero section on purpose: the header is fixed, and the hero
          carries `overflow-hidden`, which would trap it there. */}
      <SiteHeader overlay />
      <VideoOpening onAir={nowNext.now} />
      <main className="relative z-10">
        <Hero onAir={nowNext.now} next={nowNext.next} upcoming={upcoming} />
        <Originals shows={originalShows()} />
        <Week days={week} nowIso={nowIso} />
        <PillarsSection
          hoursByPillar={{
            esports: Math.round(weekHours.esports),
            anime: Math.round(weekHours.anime),
            lifestyle: Math.round(weekHours.lifestyle),
          }}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
