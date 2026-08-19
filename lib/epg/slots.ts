import "server-only";
import { asc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import type { EpgPillar, GridSlot } from "./grid";

/**
 * The repeating weekly grid, 168 rows once imported.
 *
 * Its own module so both `lib/api/schedule.ts` and `lib/api/epg.ts` can read the
 * grid without importing each other - schedule.ts needs it as a fourth source,
 * and epg.ts needs schedule.ts for the dated rows, which would otherwise be a
 * cycle.
 */
export async function getGridSlots(): Promise<GridSlot[]> {
  const rows = await db
    .select({
      id: schema.epgSlots.id,
      dayOfWeek: schema.epgSlots.dayOfWeek,
      startMinute: schema.epgSlots.startMinute,
      durationMin: schema.epgSlots.durationMin,
      title: schema.epgSlots.title,
      pillar: schema.epgSlots.pillar,
      parentalRating: schema.epgSlots.parentalRating,
      slotCode: schema.epgSlots.slotCode,
      showId: schema.epgSlots.showId,
      showSlug: schema.shows.slug,
      showPosterUrl: schema.shows.posterUrl,
    })
    .from(schema.epgSlots)
    /*
     * Left join: a slot that predates the shows catalogue still has to render.
     * Reading the poster and the slug here rather than copying them means a
     * show edit reaches the grid with nothing to keep in step.
     */
    .leftJoin(schema.shows, eq(schema.shows.id, schema.epgSlots.showId))
    .where(eq(schema.epgSlots.isActive, true))
    .orderBy(asc(schema.epgSlots.dayOfWeek), asc(schema.epgSlots.startMinute));

  return rows.map((r) => ({ ...r, pillar: r.pillar as EpgPillar }));
}
