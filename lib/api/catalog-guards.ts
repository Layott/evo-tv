import "server-only";
import { NextResponse } from "next/server";
import { and, count, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * What stops a catalogue row being deleted.
 *
 * The admin catalogue routes have carried a DELETE since they were written, and
 * the CMS never called it: the screen told the operator that deleting was "not
 * supported yet". The real reason was sound. `clips.game_id` and `vods.game_id`
 * are `ON DELETE CASCADE`, so deleting Free Fire would take every clip and
 * every recording of it with no warning and no undo.
 *
 * So the button exists now and the route refuses when anything points at the
 * row, naming what is in the way. A cascade nobody asked for is not a feature,
 * and "you cannot delete this because 41 clips use it" is a sentence an
 * operator can act on.
 */

export interface Dependent {
  label: string;
  value: number;
}

function describe(dependents: Dependent[]): string {
  return dependents
    .filter((d) => d.value > 0)
    .map((d) => `${d.value} ${d.label}${d.value === 1 ? "" : "s"}`)
    .join(", ");
}

/**
 * A 409 listing what still references the row, or null when nothing does and
 * the delete may go ahead.
 */
export function blockedByDependents(
  what: string,
  dependents: Dependent[],
): NextResponse | null {
  const summary = describe(dependents);
  if (!summary) return null;
  // "still referenced by 1 clip" rather than "1 clip still point at it": the
  // count is not known until it is counted, and only this phrasing reads
  // correctly for both one and many.
  return NextResponse.json(
    {
      error: `Cannot delete this ${what}: still referenced by ${summary}. Remove or reassign those first.`,
    },
    { status: 409 },
  );
}

/**
 * Everything that would be destroyed with a game.
 *
 * Soft-deleted rows are not counted: something already pulled from the site is
 * not a reason to refuse, and keeping it would make a game undeletable forever
 * after one clip was binned.
 */
export async function gameDependents(gameId: string): Promise<Dependent[]> {
  // Written out per table rather than through one helper: Drizzle types a
  // column against the table it belongs to, so a shared `countWhere(table,
  // column)` cannot be given a signature that accepts all three.
  const [vods, clips, streams] = await Promise.all([
    db
      .select({ value: count() })
      .from(schema.vods)
      .where(and(eq(schema.vods.gameId, gameId), isNull(schema.vods.deletedAt))),
    db
      .select({ value: count() })
      .from(schema.clips)
      .where(and(eq(schema.clips.gameId, gameId), isNull(schema.clips.deletedAt))),
    db
      .select({ value: count() })
      .from(schema.streams)
      .where(
        and(eq(schema.streams.gameId, gameId), isNull(schema.streams.deletedAt)),
      ),
  ]);
  return [
    { label: "video", value: Number(vods[0]?.value ?? 0) },
    { label: "clip", value: Number(clips[0]?.value ?? 0) },
    { label: "stream", value: Number(streams[0]?.value ?? 0) },
  ];
}

/**
 * Turn a Postgres foreign-key violation into the same 409.
 *
 * Used where the references are not cascades: the database refuses on its own,
 * and unhandled that is a 500 which reads as "the CMS is broken" rather than
 * "something still uses this".
 */
export function foreignKeyViolationResponse(
  err: unknown,
  what: string,
): NextResponse | null {
  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message?: unknown }).message ?? "")
      : String(err);
  if (!/violates foreign key constraint/i.test(message)) return null;
  return NextResponse.json(
    {
      error: `Cannot delete this ${what}: something else still references it. Remove or reassign those first.`,
    },
    { status: 409 },
  );
}
