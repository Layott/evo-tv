import type { EpgPillar } from "@/lib/epg/grid";

/**
 * One accent per pillar, used by the week grid, the on-air band and the pillar
 * blocks so a colour always means the same thing across the page.
 *
 * Written as literal hex rather than theme tokens: the landing page is
 * deliberately dark whatever the app theme is set to, and the shadcn tokens in
 * `globals.css` default to a light palette.
 */
export const PILLARS: Record<
  EpgPillar,
  { label: string; accent: string; tint: string; blurb: string }
> = {
  // Every blurb describes what is actually on the grid. Nothing here claims a
  // show, a viewer count or a partnership that does not exist.
  esports: {
    label: "Esports",
    accent: "#38bdf8",
    tint: "rgba(56,189,248,0.12)",
    blurb:
      "League nights, play-ins and finals. EA FC, Call of Duty Mobile, Free Fire and Apex Legends.",
  },
  anime: {
    label: "Anime",
    accent: "#a78bfa",
    tint: "rgba(167,139,250,0.12)",
    blurb: "Watch-alongs, reviews and long-form play. Otaku hours, on a schedule.",
  },
  lifestyle: {
    label: "Lifestyle",
    accent: "#fbbf24",
    tint: "rgba(251,191,36,0.12)",
    blurb:
      "Creator hours. Talk, music and the culture around the game, between the runs.",
  },
};

export const PILLAR_ORDER: EpgPillar[] = ["esports", "anime", "lifestyle"];
