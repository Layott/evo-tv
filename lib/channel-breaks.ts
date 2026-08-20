import "server-only";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * How the always-on channel behaves around ads and announcements.
 *
 * Three things a linear channel needs and a video-on-demand site does not:
 * a break at a regular interval, a caption saying what is on and what is next,
 * and something to show when the feed drops. All three are timing, which is why
 * they live together and are set once for the channel rather than per stream.
 *
 * Stored in the `feature_flags` row `channel.breaks`, the same trick
 * `lib/playout-config.ts` uses, so admins can change the rhythm of the channel
 * without a migration or a deploy.
 */

export const CHANNEL_BREAKS_FLAG_KEY = "channel.breaks";

export interface ChannelBreaks {
  /** Master switch. Off means the player behaves exactly as it did before. */
  enabled: boolean;
  /** Minutes between ad breaks. 0 turns breaks off and leaves the rest alone. */
  adIntervalMin: number;
  /** Longest an ad may hold the screen before the live feed is restored. */
  adMaxSec: number;
  /** Minutes between "on now, up next" cards. 0 turns the card off. */
  overlayIntervalMin: number;
  /** How long that card stays on screen. */
  overlayDurationSec: number;
  /**
   * Whether to cover a dropped feed with filler.
   *
   * The playout box is supposed to keep pushing so the feed never stops. This
   * is the second line: when the manifest dies anyway, the viewer sees the
   * `live_filler` ads on a loop instead of a black rectangle and an error.
   */
  fillerOnDrop: boolean;

  /* ── What the channel says on screen ──────────────────────────────────── */

  /**
   * Which lower third to draw.
   *
   * Three, because one house style does not fit a football night and an anime
   * block, and the alternative to a choice is an operator asking for a code
   * change every time the channel changes character.
   */
  lowerThirdStyle: OverlayStyle;
  /** Optional artwork behind the lower third. Wide strip, transparent PNG. */
  lowerThirdUrl: string;
  /** Which full-screen card announces the next programme. */
  upNextStyle: UpNextStyle;
  /** Optional artwork behind that card. 16:9. */
  upNextUrl: string;
  /**
   * How many minutes before a programme starts the full-screen card appears.
   *
   * 0 turns it off. It plays once per programme: a card that reappears every
   * few minutes stops being an announcement and becomes an interruption.
   */
  upNextLeadMin: number;
  /** How long that card holds the screen. */
  upNextSec: number;
}

/** The lower third layouts an operator can pick between. */
/**
 * The five lower thirds, as approved.
 *
 * Named for the shape rather than the occasion, because an operator picking one
 * is choosing how much of the picture to give up, not what kind of programme is
 * on.
 */
export const OVERLAY_STYLES = ["bar", "slab", "ticker", "plate", "stack"] as const;
export type OverlayStyle = (typeof OVERLAY_STYLES)[number];

/** The full-screen layouts. */
export const UP_NEXT_STYLES = ["centre", "band", "split", "countdown", "lineup"] as const;
export type UpNextStyle = (typeof UP_NEXT_STYLES)[number];

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** A URL an operator pasted, or nothing. Never a half-trimmed string. */
function urlOrBlank(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export const CHANNEL_BREAKS_DEFAULT: ChannelBreaks = {
  enabled: false,
  adIntervalMin: 20,
  adMaxSec: 30,
  overlayIntervalMin: 10,
  overlayDurationSec: 8,
  fillerOnDrop: true,
  lowerThirdStyle: "bar",
  lowerThirdUrl: "",
  upNextStyle: "centre",
  upNextUrl: "",
  upNextLeadMin: 2,
  upNextSec: 10,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? Math.round(value) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** Never throws and never returns a half-shape: a bad row reads as defaults. */
export function normalizeChannelBreaks(raw: unknown): ChannelBreaks {
  const p = (raw ?? {}) as Partial<ChannelBreaks>;
  return {
    enabled: p.enabled === true,
    adIntervalMin: clampInt(p.adIntervalMin, 0, 240, CHANNEL_BREAKS_DEFAULT.adIntervalMin),
    adMaxSec: clampInt(p.adMaxSec, 5, 180, CHANNEL_BREAKS_DEFAULT.adMaxSec),
    overlayIntervalMin: clampInt(
      p.overlayIntervalMin,
      0,
      240,
      CHANNEL_BREAKS_DEFAULT.overlayIntervalMin,
    ),
    overlayDurationSec: clampInt(
      p.overlayDurationSec,
      3,
      60,
      CHANNEL_BREAKS_DEFAULT.overlayDurationSec,
    ),
    fillerOnDrop: p.fillerOnDrop !== false,
    lowerThirdStyle: oneOf(p.lowerThirdStyle, OVERLAY_STYLES, CHANNEL_BREAKS_DEFAULT.lowerThirdStyle),
    lowerThirdUrl: urlOrBlank(p.lowerThirdUrl),
    upNextStyle: oneOf(p.upNextStyle, UP_NEXT_STYLES, CHANNEL_BREAKS_DEFAULT.upNextStyle),
    upNextUrl: urlOrBlank(p.upNextUrl),
    upNextLeadMin: clampInt(p.upNextLeadMin, 0, 60, CHANNEL_BREAKS_DEFAULT.upNextLeadMin),
    upNextSec: clampInt(p.upNextSec, 3, 60, CHANNEL_BREAKS_DEFAULT.upNextSec),
  };
}

export async function readChannelBreaks(): Promise<ChannelBreaks> {
  const row = (
    await db
      .select({ payload: schema.featureFlags.payload })
      .from(schema.featureFlags)
      .where(eq(schema.featureFlags.key, CHANNEL_BREAKS_FLAG_KEY))
      .limit(1)
  )[0];
  return normalizeChannelBreaks(row?.payload);
}
