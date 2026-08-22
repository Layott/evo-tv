import { SITE_URL } from "@/lib/site";

/**
 * Structured data, which is how a machine reads a page.
 *
 * A crawler seeing `/vod/abc` gets a wall of markup and has to guess what it is
 * looking at. The same page carrying a `VideoObject` says: this is a video,
 * here is its name, its thumbnail, how long it runs, when it went up. That is
 * the difference between a plain blue link and a result with a thumbnail and a
 * duration beside it, and for the assistants that now answer questions instead
 * of listing links, it is the difference between being quoted and being
 * skipped.
 *
 * Two rules run through every builder here, and both are about honesty rather
 * than taste:
 *
 * 1. **A field we do not have is omitted, never invented.** No made-up upload
 *    dates, no placeholder durations. `clean()` drops every empty value before
 *    the object is serialised.
 * 2. **No `aggregateRating`, no `review`.** There are no ratings on this
 *    platform. Emitting them would be fabricating evidence to win a rich
 *    result, which is both against Google's guidelines and a lie told at
 *    scale.
 *
 * None of this is visible. It renders one `<script type="application/ld+json">`
 * and changes no pixel on the page.
 */

type Json = Record<string, unknown>;

/** Drop null, undefined, empty strings and empty arrays, recursively. */
function clean<T extends Json>(input: T): T {
  const out: Json = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      const items = value
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map((v) => (isPlainObject(v) ? clean(v as Json) : v));
      if (items.length === 0) continue;
      out[key] = items;
      continue;
    }
    if (isPlainObject(value)) {
      const nested = clean(value as Json);
      if (Object.keys(nested).length === 0) continue;
      out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return out as T;
}

function isPlainObject(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Make a site-relative path absolute. Structured data needs real URLs. */
export function absolute(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

/**
 * Seconds to ISO 8601, which is the only duration format schema.org accepts.
 * 3,725 seconds is "PT1H2M5S".
 */
export function isoDuration(seconds: number | null | undefined): string | undefined {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return undefined;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `PT${h ? `${h}H` : ""}${m ? `${m}M` : ""}${s || (!h && !m) ? `${s}S` : ""}`;
}

/**
 * A date in whatever shape the database handed over, or nothing.
 *
 * The epoch is treated as absent, not as 1 January 1970. `toEpisode` fills a
 * missing `releasedAt` with `new Date(0)`, so a show that never had a release
 * date would otherwise tell every crawler it came out in 1970. A sentinel that
 * means "unset" inside the application becomes a false fact the moment it is
 * published, and the whole point of the builders here is that a field we do not
 * have is omitted rather than invented.
 */
export function isoDate(value: string | Date | null | undefined): string | undefined {
  if (!value) return undefined;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  // Nothing on this platform predates the platform. 1990 is comfortably below
  // any real date here and comfortably above the sentinel.
  if (d.getUTCFullYear() < 1990) return undefined;
  return d.toISOString();
}

/**
 * Trim a synopsis to something a search result can show.
 *
 * Cuts on a word boundary rather than mid-word, and only when the text is long
 * enough for the cut to be worth making.
 */
export function summarise(text: string | null | undefined, max = 300): string | undefined {
  const value = text?.replace(/\s+/g, " ").trim();
  if (!value) return undefined;
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > max * 0.6 ? lastSpace : max).trimEnd()}...`;
}

/* --------------------------------------------------------------- builders */

/** Who publishes all of this. Referenced by id from everything else. */
export function organization(opts: { name: string; logo?: string | null }): Json {
  return clean({
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: opts.name,
    url: SITE_URL,
    logo: absolute(opts.logo) ?? `${SITE_URL}/icon.png`,
    description:
      "Live esports, anime and lifestyle, streaming from Africa. Tournaments, shows, highlights and community.",
    areaServed: "NG",
  });
}

/**
 * The site itself.
 *
 * Deliberately no `potentialAction: SearchAction`. The search control in the
 * header navigates to `/discover` and that page takes no query parameter, so a
 * search URL template would describe a feature that does not exist. When
 * `/discover?q=` works, add it here and not before.
 */
export function website(opts: { name: string }): Json {
  return clean({
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: opts.name,
    url: SITE_URL,
    inLanguage: "en-NG",
    publisher: { "@id": `${SITE_URL}/#organization` },
  });
}

/** The trail a reader followed to get here. Renders as the path under a result. */
export function breadcrumbs(trail: Array<{ name: string; path: string }>): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: absolute(step.path),
    })),
  };
}

export function tvSeries(opts: {
  name: string;
  description?: string | null;
  path: string;
  image?: string | null;
  genre?: string | null;
  seasons?: number;
  startDate?: string | null;
}): Json {
  return clean({
    "@type": "TVSeries",
    name: opts.name,
    description: summarise(opts.description),
    url: absolute(opts.path),
    image: absolute(opts.image),
    genre: opts.genre,
    numberOfSeasons: opts.seasons && opts.seasons > 0 ? opts.seasons : undefined,
    startDate: isoDate(opts.startDate),
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en",
  });
}

export function tvEpisode(opts: {
  name: string;
  description?: string | null;
  path: string;
  image?: string | null;
  episodeNumber?: number | null;
  seasonNumber?: number | null;
  seriesName: string;
  seriesPath: string;
  duration?: number | null;
  released?: string | null;
}): Json {
  return clean({
    "@type": "TVEpisode",
    name: opts.name,
    description: summarise(opts.description),
    url: absolute(opts.path),
    image: absolute(opts.image),
    episodeNumber: opts.episodeNumber ?? undefined,
    timeRequired: isoDuration(opts.duration),
    datePublished: isoDate(opts.released),
    partOfSeries: clean({
      "@type": "TVSeries",
      name: opts.seriesName,
      url: absolute(opts.seriesPath),
    }),
    partOfSeason: opts.seasonNumber
      ? { "@type": "TVSeason", seasonNumber: opts.seasonNumber }
      : undefined,
    inLanguage: "en",
  });
}

/**
 * A piece of video.
 *
 * `thumbnailUrl` and `uploadDate` are the two fields Google treats as required
 * for a video result. Where a record genuinely has neither, the block is still
 * worth emitting: a partial description beats none, and inventing a date to
 * satisfy a validator would put a false fact in front of every crawler.
 */
export function videoObject(opts: {
  name: string;
  description?: string | null;
  path: string;
  thumbnail?: string | null;
  uploadDate?: string | null;
  duration?: number | null;
  contentUrl?: string | null;
  embedUrl?: string | null;
  live?: { startDate?: string | null; endDate?: string | null } | null;
}): Json {
  return clean({
    "@type": "VideoObject",
    name: opts.name,
    description: summarise(opts.description),
    url: absolute(opts.path),
    thumbnailUrl: absolute(opts.thumbnail),
    uploadDate: isoDate(opts.uploadDate),
    duration: isoDuration(opts.duration),
    contentUrl: opts.contentUrl ?? undefined,
    embedUrl: absolute(opts.embedUrl),
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en",
    // A live broadcast is a VideoObject carrying a BroadcastEvent, which is
    // what puts the "LIVE" badge on a search result while it is on air.
    publication: opts.live
      ? clean({
          "@type": "BroadcastEvent",
          isLiveBroadcast: true,
          startDate: isoDate(opts.live.startDate),
          endDate: isoDate(opts.live.endDate),
        })
      : undefined,
  });
}

export function sportsEvent(opts: {
  name: string;
  description?: string | null;
  path: string;
  image?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** Every event here is watched online, whatever room it is played in. */
  online?: boolean;
}): Json {
  return clean({
    "@type": "SportsEvent",
    name: opts.name,
    description: summarise(opts.description),
    url: absolute(opts.path),
    image: absolute(opts.image),
    startDate: isoDate(opts.startDate),
    endDate: isoDate(opts.endDate),
    eventAttendanceMode: opts.online
      ? "https://schema.org/OnlineEventAttendanceMode"
      : undefined,
    location: opts.online
      ? { "@type": "VirtualLocation", url: absolute(opts.path) }
      : undefined,
    organizer: { "@id": `${SITE_URL}/#organization` },
  });
}

/**
 * Something for sale.
 *
 * `offers` carries the real price and the real currency or it is left off. A
 * price in a search result that does not match the price at checkout is worse
 * than no price at all.
 */
export function product(opts: {
  name: string;
  description?: string | null;
  path: string;
  image?: string | null;
  price?: number | null;
  currency?: string | null;
  inStock?: boolean;
  /** Variant prices, when a shirt costs more in one size than another. */
  variantPrices?: number[];
}): Json {
  const hasPrice = typeof opts.price === "number" && opts.price > 0 && opts.currency;

  /*
   * A product sold in several variants has a range, not a price.
   *
   * Quoting the base price for a shirt whose XL costs more is the same
   * mismatch as quoting the wrong price outright: the searcher arrives
   * expecting the number they were shown. `AggregateOffer` is the shape that
   * says "from X to Y" honestly.
   */
  const prices = (opts.variantPrices ?? []).filter((n) => typeof n === "number" && n > 0);
  const low = prices.length ? Math.min(...prices) : undefined;
  const high = prices.length ? Math.max(...prices) : undefined;
  const isRange = low !== undefined && high !== undefined && low !== high;

  return clean({
    "@type": "Product",
    name: opts.name,
    description: summarise(opts.description),
    url: absolute(opts.path),
    image: absolute(opts.image),
    brand: { "@id": `${SITE_URL}/#organization` },
    offers: isRange
      ? clean({
          "@type": "AggregateOffer",
          lowPrice: low,
          highPrice: high,
          priceCurrency: opts.currency,
          offerCount: prices.length,
          url: absolute(opts.path),
          availability: opts.inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        })
      : hasPrice
        ? clean({
            "@type": "Offer",
            price: opts.price,
            priceCurrency: opts.currency,
            url: absolute(opts.path),
            availability: opts.inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          })
        : undefined,
  });
}

/** A competing team. Named so a search for the roster finds the right page. */
export function sportsTeam(opts: {
  name: string;
  path: string;
  logo?: string | null;
  country?: string | null;
  sport?: string | null;
}): Json {
  return clean({
    "@type": "SportsTeam",
    name: opts.name,
    url: absolute(opts.path),
    logo: absolute(opts.logo),
    // The game they play is the sport, which is the closest honest mapping
    // schema.org offers for an esports roster.
    sport: opts.sport,
    location: opts.country ? { "@type": "Country", name: opts.country } : undefined,
  });
}

/**
 * A set of questions and the answers actually printed on the page.
 *
 * Google requires the answer text to be visible to the reader, so this is only
 * ever built from copy the page already renders. Marking up an answer that is
 * not on the page is a manual-action offence, not a grey area.
 */
export function faqPage(items: Array<{ question: string; answer: string }>): Json {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** An ordered list of things, for pages that are lists of things. */
export function itemList(
  name: string,
  items: Array<{ name: string; path: string }>,
): Json {
  return {
    "@type": "ItemList",
    name,
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absolute(item.path),
    })),
  };
}

/* -------------------------------------------------------------- component */

/**
 * Render one or more blocks into a single script tag.
 *
 * `<` is escaped because a title containing `</script>` would otherwise close
 * the tag early and put page content into the document as markup. JSON-LD is
 * built from database text, so this is a real path and not a theoretical one.
 */
export function JsonLd({ data }: { data: Json | Json[] }) {
  const graph = Array.isArray(data) ? data : [data];
  const payload = {
    "@context": "https://schema.org",
    "@graph": graph,
  };
  return (
    <script
      type="application/ld+json"
      /*
       * `hidden` is not about visibility: a script never renders anyway.
       *
       * It is about Tailwind. `space-y-4` compiles to
       * `& > :not([hidden]) ~ :not([hidden])`, so a script dropped into a
       * container that uses it counts as a sibling and pushes a margin onto
       * the first visible child. None of the containers these blocks sit in
       * use `space-y` today, and this attribute means none of them can start
       * causing that later either. Crawlers parse a hidden JSON-LD block
       * exactly as they parse a visible one.
       */
      hidden
      // eslint-disable-next-line react/no-danger -- the only way to emit JSON-LD
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(payload).replace(/</g, "\\u003c"),
      }}
    />
  );
}
