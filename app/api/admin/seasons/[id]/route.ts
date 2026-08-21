import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, eq, isNull, ne } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireCapability } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import { recountShow } from "@/lib/api/shows-admin";

/**
 * Rename or remove a season.
 *
 * Seasons could only be created. A show whose second season was added by
 * mistake, or named "Seaon 2", had no way back short of psql.
 */

const patchSchema = z
  .object({
    seasonNumber: z.number().int().min(1).max(200),
    title: z.string().trim().max(200),
    releasedAt: z.string().datetime().nullable(),
  })
  .partial();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("editorial");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const existing = (
    await db.select().from(schema.seasons).where(eq(schema.seasons.id, id)).limit(1)
  )[0];
  if (!existing) return new NextResponse("Season not found", { status: 404 });

  // Renumbering is allowed, colliding is not: two seasons on one number make
  // the (showId, seasonNumber) lookup ambiguous, and every episode page goes
  // through it.
  if (
    parsed.data.seasonNumber !== undefined &&
    parsed.data.seasonNumber !== existing.seasonNumber
  ) {
    const clash = (
      await db
        .select({ id: schema.seasons.id })
        .from(schema.seasons)
        .where(
          and(
            eq(schema.seasons.showId, existing.showId),
            eq(schema.seasons.seasonNumber, parsed.data.seasonNumber),
            ne(schema.seasons.id, id),
          ),
        )
        .limit(1)
    )[0];
    if (clash) {
      return NextResponse.json(
        { error: `This show already has a season ${parsed.data.seasonNumber}` },
        { status: 409 },
      );
    }
  }

  if (Object.keys(parsed.data).length > 0) {
    await db.update(schema.seasons).set(parsed.data).where(eq(schema.seasons.id, id));

    // The episodes carry a denormalised `seasonNumber`, so renumbering the
    // season without moving them would leave every episode filed under a
    // season number that no longer exists.
    if (parsed.data.seasonNumber !== undefined) {
      await db
        .update(schema.episodes)
        .set({ seasonNumber: parsed.data.seasonNumber })
        .where(eq(schema.episodes.seasonId, id));
    }

    await writeAudit({
      actorId: guard.user.id,
      actorRole: guard.role,
      capability: "editorial",
      action: "season.update",
      targetType: "season",
      targetId: id,
      meta: {
        fields: Object.keys(parsed.data),
        showId: existing.showId,
        seasonNumber: existing.seasonNumber,
      },
    });
  }

  const season = (
    await db.select().from(schema.seasons).where(eq(schema.seasons.id, id)).limit(1)
  )[0];
  return NextResponse.json({ season });
}

/**
 * DELETE /api/admin/seasons/[id] - remove an empty season.
 *
 * A hard delete, and only when nothing is inside it. `episodes.season_id`
 * cascades, so deleting a full season would silently take every episode and
 * every uploaded video reference with it. An operator who really means that can
 * pull the episodes first, which is a decision made one row at a time.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("editorial");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const season = (
    await db.select().from(schema.seasons).where(eq(schema.seasons.id, id)).limit(1)
  )[0];
  if (!season) return new NextResponse("Season not found", { status: 404 });

  const live = (
    await db
      .select({ value: count() })
      .from(schema.episodes)
      .where(
        and(eq(schema.episodes.seasonId, id), isNull(schema.episodes.deletedAt)),
      )
  )[0];
  const episodeCount = Number(live?.value ?? 0);
  if (episodeCount > 0) {
    return NextResponse.json(
      {
        error: `Season ${season.seasonNumber} still has ${episodeCount} episode${
          episodeCount === 1 ? "" : "s"
        }. Pull those first.`,
      },
      { status: 409 },
    );
  }

  await db.delete(schema.seasons).where(eq(schema.seasons.id, id));
  await recountShow(season.showId);

  await writeAudit({
    before: season as unknown as Record<string, unknown>,
    after: null,
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "editorial",
    action: "season.delete",
    targetType: "season",
    targetId: id,
    meta: { showId: season.showId, seasonNumber: season.seasonNumber },
  });

  return NextResponse.json({ ok: true, seasonId: id });
}
