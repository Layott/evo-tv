import type { EpgPillar } from "./grid";

/**
 * Show artwork, as a code-side registry rather than database rows.
 *
 * Posters are design assets that ship with a release, not user data: they are
 * committed under `public/shows/`, they change with the build, and there is no
 * admin screen that edits them. Putting them in Postgres would mean a migration
 * plus a seed every time the design team delivers a poster.
 *
 * `title` is matched against `epg_slots.title` after normalisation, so a grid
 * slot picks up its artwork automatically once an entry lands here. Most of the
 * 25 titles in the April grid have no poster yet; those render as typographic
 * cards, which is the honest fallback rather than a placeholder image.
 */

export type ArtPolarity = "dark" | "light";

export interface ShowArt {
  slug: string;
  /** Display title. */
  title: string;
  /** Sub-brand printed on the poster, if any. */
  brand?: string;
  /** Strapline taken verbatim off the poster. Never invented. */
  tagline?: string;
  /** Social handle printed on the poster. */
  handle?: string;
  poster: string;
  posterSmall: string;
  /** 16px-wide WebP, inlined so cards do not flash empty on a slow connection. */
  blurDataURL: string;
  /** Whether the artwork itself is dark or light, so chrome can adapt. */
  polarity: ArtPolarity;
  /** Sampled from the artwork, not chosen. */
  accent: string;
  /**
   * The same hue lifted to stay legible as text on the near-black landing page.
   * HYP's sampled red is `#b70000`, which is close to invisible on `--ink`.
   */
  accentOnDark: string;
  pillar: EpgPillar;
  /** Titles as they appear in the EPG grid, if this show is scheduled. */
  gridTitles?: string[];
}

export const SHOW_ART: ShowArt[] = [
  {
    slug: "sucres-space",
    title: "Sucre's Space",
    handle: "@sucresspace",
    poster: "/shows/sucres-space.webp",
    posterSmall: "/shows/sucres-space@540.webp",
    blurDataURL:
      "data:image/webp;base64,UklGRqIAAABXRUJQVlA4IJYAAACQBACdASoQABQAPu1iqU2ppaOiMAgBMB2JZQCsAdwA+bqVaV08iLF4WE4QVAAA/vSeAR63A2/Upe/fdWCzBWCh3y6iIS/exoq1N/nU6v+OO9qjfMpibphUhCjBYyHAzLj8MQtYqYflpqmJVBkLWmEHuF002xHTc0xkOHHl5rERYfez73mf1nvlIlydq3iCqMkFu5UAAAA=",
    polarity: "dark",
    accent: "#f29013",
    // 8.1:1 on --ink, already legible unchanged.
    accentOnDark: "#f29013",
    pillar: "lifestyle",
  },
  {
    slug: "hyp-confessionals",
    title: "Take a Seat: Confessionals",
    brand: "HYP",
    tagline: "Hustle. Yell. Persist.",
    poster: "/shows/hyp-confessionals.webp",
    posterSmall: "/shows/hyp-confessionals@540.webp",
    blurDataURL:
      "data:image/webp;base64,UklGRqgAAABXRUJQVlA4IJwAAADwAwCdASoQABQAPu1iqU2ppaOiMAgBMB2JYwAD48G3fZEWqWKXrXgcAP4HniE5SIV4PJiZ8rcRCKDHD2qtOIgxA6M/Z9keF/1NEgq/dNufjumfPEUiM/Z1WkbOhn/VTzSl5ly8kGjV2/BEpJxIg5ebFGwEkO8+X9toqVDy9KmUF+GN+iK4vis7buDRiQ3Ohx2rw/94D+oj+fjXgAA=",
    polarity: "light",
    accent: "#b70000",
    // The sampled red is 2.8:1 on --ink and effectively invisible. Lifted to
    // 5.8:1, and kept red rather than orange so it stays distinct from --flame.
    accentOnDark: "#ff4a38",
    pillar: "lifestyle",
  },
];

function normalise(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BY_TITLE = new Map<string, ShowArt>();
for (const art of SHOW_ART) {
  BY_TITLE.set(normalise(art.title), art);
  for (const t of art.gridTitles ?? []) BY_TITLE.set(normalise(t), art);
}

/** Artwork for a programme title, or null when none has been delivered yet. */
export function artForTitle(title: string): ShowArt | null {
  return BY_TITLE.get(normalise(title)) ?? null;
}

/**
 * Shows with finished artwork that are not on the weekly grid.
 *
 * Neither of the current two appears in the April rotation. Giving them an
 * invented airtime so they could sit in the week grid would be exactly the
 * fabrication the rest of this feature exists to avoid, so they get a rail of
 * their own with no times attached.
 */
export function unscheduledShows(gridTitles: string[]): ShowArt[] {
  const scheduled = new Set(gridTitles.map(normalise));
  return SHOW_ART.filter((art) => {
    const keys = [art.title, ...(art.gridTitles ?? [])].map(normalise);
    return !keys.some((k) => scheduled.has(k));
  });
}
