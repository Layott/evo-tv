import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireCapability } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import { recountShow, urlOrPath } from "@/lib/api/shows-admin";
import { refreshShowStatus } from "@/lib/api/show-state";

/**
 * Edit and pull a single episode.
 *
 * Hung off `/api/admin/episodes/[id]` rather than nested under its show,
 * because an episode id is unique on its own and the manage panel already holds
 * one: routing the edit back through the show would mean the client had to
 * remember which show a row came from to save it.
 */

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    synopsis: z.string().max(4000),
    thumbnailUrl: urlOrPath,
    hlsUrl: urlOrPath,
    runtimeSec: z.number().int().min(0).max(24 * 60 * 60),
    episodeNumber: z.number().int().min(1).max(2000),
    isPremium: z.boolean(),
    maturityRating: z.enum(["kids", "pg", "teen", "mature"]),
    contentTags: z.array(z.string().trim().min(1).max(40)).max(30),
    introStartSec: z.number().int().min(0).nullable(),
    introEndSec: z.number().int().min(0).nullable(),
    premiereAt: z.string().datetime().nullable(),
    releasedAt: z.string().datetime().nullable(),
  })
  .partial();

/** PATCH /api/admin/episodes/[id] - partial update. Omitted fields are untouched. */
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
    await db
      .select()
      .from(schema.episodes)
      .where(eq(schema.episodes.id, id))
      .limit(1)
  )[0];
  if (!existing) return new NextResponse("Episode not found", { status: 404 });

  // Renumbering is allowed, colliding is not: two episodes on one number make
  // the (showId, seasonNumber, episodeNumber) lookup pick one at random.
  if (
    parsed.data.episodeNumber !== undefined &&
    parsed.data.episodeNumber !== existing.episodeNumber
  ) {
    const clash = (
      await db
        .select({ id: schema.episodes.id })
        .from(schema.episodes)
        .where(
          and(
            eq(schema.episodes.seasonId, existing.seasonId),
            eq(schema.episodes.episodeNumber, parsed.data.episodeNumber),
            ne(schema.episodes.id, id),
          ),
        )
        .limit(1)
    )[0];
    if (clash) {
      return NextResponse.json(
        {
          error: `Season ${existing.seasonNumber} already has an episode ${parsed.data.episodeNumber}`,
        },
        { status: 409 },
      );
    }
  }

  if (Object.keys(parsed.data).length > 0) {
    await db
      .update(schema.episodes)
      .set(parsed.data)
      .where(eq(schema.episodes.id, id));

    await writeAudit({
      actorId: guard.user.id,
      actorRole: guard.role,
      capability: "editorial",
      action: "episode.update",
      targetType: "episode",
      targetId: id,
      meta: {
        fields: Object.keys(parsed.data),
        showId: existing.showId,
        title: existing.title,
      },
    });
  }

  // A release date moving in or out of the past changes the show's status.
  await refreshShowStatus(existing.showId);

  const episode = (
    await db
      .select()
      .from(schema.episodes)
      .where(eq(schema.episodes.id, id))
      .limit(1)
  )[0];
  return NextResponse.json({ episode });
}

/**
 * DELETE /api/admin/episodes/[id] - soft delete, then recount.
 *
 * The counters on the show and the season are stored, so pulling an episode
 * without recounting leaves a season claiming an episode nobody can reach.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("editorial");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const episode = (
    await db
      .select()
      .from(schema.episodes)
      .where(eq(schema.episodes.id, id))
      .limit(1)
  )[0];
  if (!episode) return new NextResponse("Episode not found", { status: 404 });
  if (episode.deletedAt) {
    return NextResponse.json({ error: "Already deleted" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  await db
    .update(schema.episodes)
    .set({ deletedAt: nowIso })
    .where(eq(schema.episodes.id, id));

  await recountShow(episode.showId);
  await refreshShowStatus(episode.showId);

  await writeAudit({
    before: episode as unknown as Record<string, unknown>,
    after: null,
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "editorial",
    action: "episode.delete",
    targetType: "episode",
    targetId: id,
    meta: {
      showId: episode.showId,
      title: episode.title,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
    },
  });

  return NextResponse.json({ ok: true, episodeId: id, deletedAt: nowIso });
}
