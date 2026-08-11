import type { EpgPillar } from "./grid";

/**
 * Show artwork, as a code-side registry rather than database rows.
 *
 * Posters and trailers are design assets that ship with a release, not user
 * data: they are committed under `public/shows/`, they change with the build,
 * and there is no admin screen that edits them. Putting them in Postgres would
 * mean a migration plus a seed every time the design team delivers a poster.
 *
 * `title` and `gridTitles` are matched against `epg_slots.title` after
 * normalisation, so a grid slot picks up its artwork automatically. Most of the
 * 25 titles in the April grid have no poster yet; those render as typographic
 * rows, which is the honest fallback rather than a placeholder image.
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
  /**
   * When it airs, in the words the August calendar uses. That file gives a day
   * and a rough band ("Friday afternoon"), never a clock time, so neither does
   * this.
   */
  airs?: string;
  poster: string;
  posterSmall: string;
  /** Muted, looping trailer. Optional; cards fall back to the still. */
  trailer?: string;
  /** 16px-wide WebP, inlined so cards do not flash empty on a slow connection. */
  blurDataURL: string;
  /** Whether the artwork itself is dark or light, so chrome can adapt. */
  polarity: ArtPolarity;
  /** Sampled from the artwork, not chosen. */
  accent: string;
  /**
   * The same hue lifted to stay legible as text on the near-black landing page.
   * HYP's sampled red is `#b70000` (2.6:1) and Otaku's magenta `#c913ea`
   * (4.1:1); both are lifted above 6:1 here.
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
    airs: "Saturdays",
    poster: "/shows/sucres-space.webp",
    posterSmall: "/shows/sucres-space@540.webp",
    trailer: "/shows/sucres-space-trailer.mp4",
    blurDataURL:
      "data:image/webp;base64,UklGRqIAAABXRUJQVlA4IJYAAACQBACdASoQABQAPu1iqU2ppaOiMAgBMB2JZQCsAdwA+bqVaV08iLF4WE4QVAAA/vSeAR63A2/Upe/fdWCzBWCh3y6iIS/exoq1N/nU6v+OO9qjfMpibphUhCjBYyHAzLj8MQtYqYflpqmJVBkLWmEHuF002xHTc0xkOHHl5rERYfez73mf1nvlIlydq3iCqMkFu5UAAAA=",
    polarity: "dark",
    accent: "#f29013",
    accentOnDark: "#f29013",
    pillar: "lifestyle",
    gridTitles: ["SUCRE'S SPACE"],
  },
  {
    slug: "hyp-confessionals",
    title: "Take a Seat: Confessionals",
    brand: "HYP",
    tagline: "Hustle. Yell. Persist.",
    airs: "Fridays",
    poster: "/shows/hyp-confessionals.webp",
    posterSmall: "/shows/hyp-confessionals@540.webp",
    blurDataURL:
      "data:image/webp;base64,UklGRqgAAABXRUJQVlA4IJwAAADwAwCdASoQABQAPu1iqU2ppaOiMAgBMB2JYwAD48G3fZEWqWKXrXgcAP4HniE5SIV4PJiZ8rcRCKDHD2qtOIgxA6M/Z9keF/1NEgq/dNufjumfPEUiM/Z1WkbOhn/VTzSl5ly8kGjV2/BEpJxIg5ebFGwEkO8+X9toqVDy9KmUF+GN+iK4vis7buDRiQ3Ohx2rw/94D+oj+fjXgAA=",
    polarity: "light",
    accent: "#b70000",
    accentOnDark: "#ff4a38",
    pillar: "lifestyle",
    gridTitles: ["TAKE A SEAT CONFESSIONALS", "HYP"],
  },
  {
    slug: "otaku-and-chillz",
    title: "Otaku & Chillz",
    tagline: "With Cyan",
    airs: "Friday afternoons",
    poster: "/shows/otaku-and-chillz.webp",
    posterSmall: "/shows/otaku-and-chillz@540.webp",
    trailer: "/shows/otaku-and-chillz-trailer.mp4",
    blurDataURL:
      "data:image/webp;base64,UklGRqwAAABXRUJQVlA4IKAAAABwBACdASoQABQAPu1iqU2ppaOiMAgBMB2JbACdMoAlxhQjKkB9Ai2zrJ4LdAD+0fEfnrSCn1ClzZnmrPVapHRg7zEizJuVZoXVPXf5QzEmV36Z7w02V156b7WwMp8GHkMdmt6A+3mMBNU8Gr+CqOBLCzgOY/sBHc8wh7ZHvXMYkFKmVyrjwOsyY8ArVv5FsJyCgHaQxvFet8K34JOPAAAA",
    polarity: "dark",
    accent: "#c913ea",
    accentOnDark: "#d96bf5",
    pillar: "anime",
    // The April grid spells it "OTAKU AND CHILLS"; the poster spells it
    // "OTAKU & CHILLZ". Both normalise to the same key, but both are listed so
    // the intent survives a change to `normalise`.
    gridTitles: ["OTAKU AND CHILLS", "OTAKU & CHILLZ"],
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
 * EVO's own shows, for the Originals rail.
 *
 * Returns every show with artwork, scheduled or not. An earlier version hid any
 * show that appeared on the grid, which meant the rail emptied out the moment
 * the August originals were imported - deleting the best thing on the page as a
 * side effect of scheduling it. The rail is the shows; the grid is when they
 * air, and the card carries the day.
 */
export function originalShows(): ShowArt[] {
  return SHOW_ART;
}
