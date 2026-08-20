import "server-only";

import { HLS_VARIANT_SUFFIXES, RUNGS } from "@/lib/video/rungs";

/**
 * The master playlist, filtered for one viewer.
 *
 * An HLS master is pairs of lines: an `#EXT-X-STREAM-INF` describing a rung,
 * then the URI of that rung's own playlist. Everything else (the header, any
 * `#EXT-X-MEDIA`) is carried through untouched, because a line this code does
 * not understand is a line it has no business dropping.
 *
 * Two things are removed. The premium rungs, when the viewer has not paid for
 * them, which is the point of the exercise. And any rung the caller says is not
 * actually publishing: production advertises `_fhd` whether or not the encoder
 * is sending it, and a player that picks an advertised rung with no segments
 * behind it stalls on a black screen rather than falling back.
 *
 * Relative URIs are made absolute against the origin master. Our route lives on
 * a different path from nginx's, so `stream_x_hi.m3u8` would otherwise resolve
 * against `/api/hls/…` and 404.
 */

const PREMIUM_SUFFIXES = new Set(
  RUNGS.filter((r) => r.premiumOnly).map((r) => r.suffix),
);

/** The rung a variant URI belongs to, or null if it carries no suffix. */
export function suffixOf(uri: string): string | null {
  const name = uri.split("?")[0]!.split("/").pop() ?? uri;
  const base = name.replace(/\.m3u8$/i, "");
  for (const suffix of HLS_VARIANT_SUFFIXES) {
    if (base.endsWith(suffix)) return suffix;
  }
  return null;
}

export interface FilterOptions {
  /** The playlist as nginx wrote it. */
  master: string;
  /** Where it was fetched from, for resolving relative variant URIs. */
  originUrl: string;
  /** Whether the premium rungs belong in the answer. */
  hd: boolean;
  /**
   * Which variant URIs are actually serving. Absent means "do not check",
   * which is the right default when the probe itself failed: a probe that
   * cannot reach nginx should not be able to empty somebody's playlist.
   */
  publishing?: Set<string>;
}

export interface FilterResult {
  playlist: string;
  /** What was dropped, so the route can log a stream advertising nothing. */
  keptVariants: number;
  droppedForTier: number;
  droppedNotPublishing: number;
}

export function filterMaster({
  master,
  originUrl,
  hd,
  publishing,
}: FilterOptions): FilterResult {
  const lines = master.split(/\r?\n/);
  const out: string[] = [];
  let keptVariants = 0;
  let droppedForTier = 0;
  let droppedNotPublishing = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;

    if (!line.startsWith("#EXT-X-STREAM-INF")) {
      out.push(line);
      continue;
    }

    // The URI is the next non-blank, non-comment line. A master that ends on a
    // STREAM-INF is malformed; carrying the orphan through is closer to the
    // original than inventing a URI for it.
    let j = i + 1;
    while (j < lines.length && (lines[j]!.trim() === "" || lines[j]!.startsWith("#"))) {
      j += 1;
    }
    const uri = lines[j];
    if (uri === undefined) {
      out.push(line);
      continue;
    }

    const absolute = new URL(uri.trim(), originUrl).toString();
    const suffix = suffixOf(uri.trim());
    const isPremium = suffix !== null && PREMIUM_SUFFIXES.has(suffix as never);

    if (isPremium && !hd) {
      droppedForTier += 1;
      i = j;
      continue;
    }
    if (publishing && !publishing.has(absolute)) {
      droppedNotPublishing += 1;
      i = j;
      continue;
    }

    out.push(line, absolute);
    keptVariants += 1;
    i = j;
  }

  return {
    playlist: out.join("\n"),
    keptVariants,
    droppedForTier,
    droppedNotPublishing,
  };
}
