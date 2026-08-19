import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { generateId, requireCapability } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import { nextSeasonNumber, recountShow } from "@/lib/api/shows-admin";

/** GET /api/admin/shows/[id]/seasons - every season on a show, in order. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const seasons = await db
    .select()
    .from(schema.seasons)
    .where(eq(schema.seasons.showId, id))
    .orderBy(asc(schema.seasons.seasonNumber));

  return NextResponse.json({ seasons });
}

const createSchema = z.object({
  /** Omit to take the next free number on this show. */
  seasonNumber: z.number().int().min(1).max(200).optional(),
  title: z.string().trim().max(200).default(""),
  releasedAt: z.string().datetime().nullable().default(null),
});

/**
 * POST /api/admin/shows/[id]/seasons - add a season.
 *
 * The show is looked up first so a season cannot be hung off an id that does
 * not exist; the foreign key would catch it, but with a Postgres error rather
 * than a 404 an editor can read.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("editorial");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const show = (
    await db
      .select({ id: schema.shows.id, title: schema.shows.title })
      .from(schema.shows)
      .where(eq(schema.shows.id, id))
      .limit(1)
  )[0];
  if (!show) return new NextResponse("Show not found", { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const seasonNumber = parsed.data.seasonNumber ?? (await nextSeasonNumber(id));

  // There is an index on (showId, seasonNumber) but no unique constraint, so a
  // duplicate would insert happily and then make the episode lookup ambiguous.
  // Checked here rather than left to the database for that reason.
  const clash = (
    await db
      .select({ id: schema.seasons.id })
      .from(schema.seasons)
      .where(
        and(
          eq(schema.seasons.showId, id),
          eq(schema.seasons.seasonNumber, seasonNumber),
        ),
      )
      .limit(1)
  )[0];
  if (clash) {
    return NextResponse.json(
      { error: `Season ${seasonNumber} already exists on this show` },
      { status: 409 },
    );
  }

  const seasonId = generateId("season");
  await db.insert(schema.seasons).values({
    id: seasonId,
    showId: id,
    seasonNumber,
    title: parsed.data.title,
    episodeCount: 0,
    releasedAt: parsed.data.releasedAt,
  });

  await recountShow(id);

  await writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "editorial",
    action: "season.create",
    targetType: "season",
    targetId: seasonId,
    meta: { showId: id, showTitle: show.title, seasonNumber },
  });

  const season = (
    await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.id, seasonId))
      .limit(1)
  )[0];
  return NextResponse.json({ season }, { status: 201 });
}
