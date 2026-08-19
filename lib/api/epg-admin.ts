import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { MINUTES_PER_DAY, minuteLabel } from "@/lib/epg/grid";
import { MAX_DURATION_MIN, MIN_DURATION_MIN, dayName, type SlotSpan } from "@/lib/epg/admin";

/**
 * Server-side pieces shared by the three `/api/admin/epg` route files.
 *
 * They live here rather than in one of the route modules because a `route.ts`
 * may only export HTTP handlers and the Next route config keys: exporting a
 * schema from one and importing it into another is a build error, not a
 * refactor.
 */

export const slotBodySchema = z.object({
  /** ISO-8601 weekday: 1 = Monday ... 7 = Sunday, same as Postgres `isodow`. */
  dayOfWeek: z.number().int().min(1).max(7),
  /** Minutes from local midnight in Africa/Lagos. The client parses HH:MM. */
  startMinute: z.number().int().min(0).max(MINUTES_PER_DAY - 1),
  durationMin: z.number().int().min(MIN_DURATION_MIN).max(MAX_DURATION_MIN),
  /**
   * The show being scheduled.
   *
   * Programming used to be a typed string, which meant the grid and the shows
   * catalogue were two lists of names that only looked related: a typo made a
   * new programme, and nothing on the site could link "what is on" to "what is
   * this". The title and pillar are copied from the show rather than sent.
   */
  showId: z.string().trim().min(1),
  /**
   * The second line on air, and the slot's own property.
   *
   * Which game this hour is, whose session it is. It used to be the half of the
   * title after a backslash, which meant it could not be edited: an operator
   * renamed the show, the second line stayed, and there was nowhere to change
   * it because it was not a field.
   */
  subtitle: z.string().trim().max(120).nullable().default(null),
  /** 16 | 18 in the source grid. Null is unrated, which is not "all ages". */
  parentalRating: z.number().int().min(0).max(21).nullable().default(null),
});

export type SlotBody = z.infer<typeof slotBodySchema>;

/** An edit sends only what changed, so every field is optional. */
export const slotPatchSchema = slotBodySchema.partial();

/**
 * The title and pillar a slot should carry, read off the show it points at.
 *
 * Copied onto the row rather than joined at read time: `epg_slots` is read on
 * every landing page render and by `/api/schedule`, both of which would
 * otherwise need a join to print a programme name. Kept in step by every write
 * that touches the link.
 */
export async function showFacts(
  showId: string,
): Promise<{
  title: string;
  /** Null when the show is unfiled, which a slot copies as-is. */
  pillar: "esports" | "anime" | "lifestyle" | null;
} | null> {
  const row = (
    await db
      .select({ title: schema.shows.title, pillar: schema.shows.pillar })
      .from(schema.shows)
      .where(eq(schema.shows.id, showId))
      .limit(1)
  )[0];
  return row ?? null;
}

/** The columns collision checks need, for every slot currently on air. */
export async function activeSlotSpans(): Promise<SlotSpan[]> {
  return db
    .select({
      id: schema.epgSlots.id,
      dayOfWeek: schema.epgSlots.dayOfWeek,
      startMinute: schema.epgSlots.startMinute,
      durationMin: schema.epgSlots.durationMin,
      title: schema.epgSlots.title,
    })
    .from(schema.epgSlots)
    .where(eq(schema.epgSlots.isActive, true));
}

/**
 * The 409 an operator can act on, for a start time that is already taken.
 *
 * `epg_slots` carries a unique index on (day_of_week, start_minute) for active
 * rows, so a duplicate start is a Postgres 23505 and, unhandled, a 500 that
 * reads as "the CMS is broken".
 */
export function startTakenResponse(
  dayOfWeek: number,
  startMinute: number,
  occupant?: string,
): NextResponse {
  const where = `${dayName(dayOfWeek)} ${minuteLabel(startMinute)}`;
  return NextResponse.json(
    {
      error: occupant
        ? `${where} already has "${occupant}". Edit that slot or pick another start time.`
        : `${where} already has a slot. Edit that slot or pick another start time.`,
    },
    { status: 409 },
  );
}

/**
 * Map a unique-constraint violation onto the same 409.
 *
 * The pre-check catches the ordinary case with the occupant's name in the
 * message; this catches the race between two admins saving the same minute.
 * Returns null for anything else so the caller can re-raise.
 */
export function uniqueViolationResponse(
  err: unknown,
  dayOfWeek: number,
  startMinute: number,
): NextResponse | null {
  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message?: unknown }).message ?? "")
      : String(err);
  if (!/duplicate key value violates unique constraint/i.test(message)) return null;
  return startTakenResponse(dayOfWeek, startMinute);
}
