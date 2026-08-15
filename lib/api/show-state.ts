import "server-only";
import { and, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { priceAtDay, type PriceWindow } from "@/lib/shows/pricing";

/**
 * A show's status, worked out rather than chosen.
 *
 * It used to be a dropdown, which meant the catalogue said "airing" for a
 * series whose last episode landed in April and whose slot left the grid in
 * May. Nobody lies on purpose; a field like that just goes stale the moment
 * attention moves on.
 *
 * The rules, in order:
 *
 *   ended_at set                      -> completed
 *   an episode released in the last 45 days -> airing
 *   a live slot in the weekly grid    -> airing
 *   an episode released, but not lately -> hiatus
 *   nothing released yet              -> upcoming
 *
 * 45 days rather than 30: a fortnightly show that skips a week is still airing,
 * and calling that a hiatus would be wrong more often than it was right.
 */
export type DerivedShowStatus = "airing" | "completed" | "upcoming" | "hiatus";

const AIRING_WINDOW_DAYS = 45;

export async function deriveShowStatus(
  showId: string,
  endedAt: string | null,
): Promise<DerivedShowStatus> {
  if (endedAt) return "completed";

  const episodes = await db
    .select({ releasedAt: schema.episodes.releasedAt })
    .from(schema.episodes)
    .where(
      and(eq(schema.episodes.showId, showId), isNull(schema.episodes.deletedAt)),
    );

  const nowMs = Date.now();
  const released = episodes
    .map((e) => (e.releasedAt ? new Date(e.releasedAt).getTime() : null))
    .filter((t): t is number => t !== null && t <= nowMs);

  if (released.length > 0) {
    const newest = Math.max(...released);
    const ageDays = (nowMs - newest) / 86_400_000;
    if (ageDays <= AIRING_WINDOW_DAYS) return "airing";
  }

  // A show with no episodes in the library can still be on air: the channel is
  // a rotation, and a slot in the grid is a broadcast commitment.
  const slot = (
    await db
      .select({ id: schema.epgSlots.id })
      .from(schema.epgSlots)
      .where(
        and(eq(schema.epgSlots.showId, showId), eq(schema.epgSlots.isActive, true)),
      )
      .limit(1)
  )[0];
  if (slot) return "airing";

  return released.length > 0 ? "hiatus" : "upcoming";
}

/** Recompute and persist. Called after anything that could change the answer. */
export async function refreshShowStatus(showId: string): Promise<DerivedShowStatus> {
  const show = (
    await db
      .select({ id: schema.shows.id, endedAt: schema.shows.endedAt })
      .from(schema.shows)
      .where(eq(schema.shows.id, showId))
      .limit(1)
  )[0];
  if (!show) return "upcoming";

  const status = await deriveShowStatus(showId, show.endedAt);
  await db.update(schema.shows).set({ status }).where(eq(schema.shows.id, showId));
  return status;
}

/* ── Pricing ────────────────────────────────────────────────────────────── */

export async function listPriceWindows(showId: string): Promise<PriceWindow[]> {
  const rows = await db
    .select({
      fromDay: schema.showPriceWindows.fromDay,
      priceNgn: schema.showPriceWindows.priceNgn,
    })
    .from(schema.showPriceWindows)
    .where(eq(schema.showPriceWindows.showId, showId));
  return rows.sort((a, b) => a.fromDay - b.fromDay);
}

/**
 * Replace a show's price schedule wholesale.
 *
 * Rewritten rather than diffed: the editor hands back the whole ladder every
 * time, and a diff would have to guess whether a missing row was deleted or
 * simply not sent.
 */
export async function replacePriceWindows(
  showId: string,
  windows: PriceWindow[],
): Promise<void> {
  await db
    .delete(schema.showPriceWindows)
    .where(eq(schema.showPriceWindows.showId, showId));

  if (windows.length === 0) return;

  await db.insert(schema.showPriceWindows).values(
    windows.map((w) => ({
      id: `spw_${showId.slice(-8)}_${w.fromDay}`,
      showId,
      fromDay: w.fromDay,
      priceNgn: w.priceNgn,
    })),
  );
}

/** What this show costs a viewer right now, given its release date. */
export async function currentPrice(
  showId: string,
  releasedAt: string | null,
): Promise<number | null> {
  const windows = await listPriceWindows(showId);
  if (windows.length === 0) return null;
  const days = releasedAt
    ? Math.floor((Date.now() - new Date(releasedAt).getTime()) / 86_400_000)
    : 0;
  return priceAtDay(windows, days);
}
