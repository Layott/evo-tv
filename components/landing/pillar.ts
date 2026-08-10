import type { EpgPillar } from "@/lib/epg/grid";

/**
 * Pillars carry a name and a description. Deliberately **no colour per pillar**.
 *
 * The first version gave each one an accent and rendered it as a small coloured
 * dot beside every row, which is the single most dashboard-looking thing on a
 * page and reads as generic. The channel has one accent, `--brand`, reserved for
 * what is on air right now. Category is communicated by the word.
 */
export const PILLARS: Record<EpgPillar, { label: string; blurb: string }> = {
  // Every blurb describes what is actually on the grid. Nothing claims a show,
  // a viewer count or a partnership that does not exist.
  esports: {
    label: "Esports",
    blurb:
      "League nights, play-ins and finals. EA FC, Call of Duty Mobile, Free Fire and Apex Legends.",
  },
  anime: {
    label: "Anime",
    blurb: "Watch-alongs, reviews and long-form play. Otaku hours, on a schedule.",
  },
  lifestyle: {
    label: "Lifestyle",
    blurb:
      "Creator hours. Talk, music and the culture around the game, between the runs.",
  },
};

export const PILLAR_ORDER: EpgPillar[] = ["esports", "anime", "lifestyle"];
