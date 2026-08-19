import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, asc, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import { priceWindow, socialLink, urlOrPath } from "@/lib/api/shows-admin";
import {
  listPriceWindows,
  refreshShowStatus,
  replacePriceWindows,
} from "@/lib/api/show-state";
import { MAX_PRICE_WINDOWS } from "@/lib/shows/pricing";
import { slugForShow } from "@/lib/api/slugs";

/**
 * GET /api/admin/shows/[id] - everything the show editor needs, in one round trip.
 *
 * Reads the row directly rather than through `getShowById`, because that helper
 * filters out soft-deleted shows and an admin still has to be able to open one.
 * Seasons and episodes come back alongside it so the manage panel can render
 * the whole tree without a request per season.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const show = (
    await db.select().from(schema.shows).where(eq(schema.shows.id, id)).limit(1)
  )[0];
  if (!show) return new NextResponse("Show not found", { status: 404 });

  const [seasons, episodes] = await Promise.all([
    db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.showId, id))
      .orderBy(asc(schema.seasons.seasonNumber)),
    db
      .select()
      .from(schema.episodes)
      .where(
        and(eq(schema.episodes.showId, id), isNull(schema.episodes.deletedAt)),
      )
      .orderBy(asc(schema.episodes.seasonNumber), asc(schema.episodes.episodeNumber)),
  ]);

  return NextResponse.json({
    show,
    seasons,
    episodes,
    priceWindows: await listPriceWindows(id),
  });
}

const patchSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    synopsis: z.string().max(4000),
    pillar: z.enum(["esports", "anime", "lifestyle"]).nullable(),
    originType: z.enum(["evo_original", "licensed", "syndicated"]),
    primaryCreatorHandle: z.string().trim().max(100),
    socialLinks: z.array(socialLink).max(8),
    posterUrl: urlOrPath,
    heroUrl: urlOrPath,
    tags: z.array(z.string().trim().min(1).max(40)).max(30),
    isPremium: z.boolean(),
    priceWindows: z.array(priceWindow).max(MAX_PRICE_WINDOWS),
    maturityRating: z.enum(["kids", "pg", "teen", "mature"]),
    contentTags: z.array(z.string().trim().min(1).max(40)).max(30),
    releasedAt: z.string().datetime().nullable(),
    /** The one editorial state left: a series that has finished for good. */
    endedAt: z.string().datetime().nullable(),
    rating: z.number().min(0).max(10),
  })
  .partial();

/**
 * PATCH /api/admin/shows/[id] - partial update. Omitted fields are untouched.
 *
 * Renaming a show moves its URL with it, because the slug is derived from the
 * title rather than typed beside it. That is the trade the rule makes: no
 * chance of a URL that says something the show does not, at the cost of a
 * rename being a real move. The old address stops resolving, so renaming a
 * published show is not free.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminFromRequest();
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
    await db.select().from(schema.shows).where(eq(schema.shows.id, id)).limit(1)
  )[0];
  if (!existing) return new NextResponse("Show not found", { status: 404 });

  const { priceWindows, ...columns } = parsed.data;

  // The slug follows the title. `exceptShowId` so a rename that reduces to the
  // slug the row already holds is not treated as a collision with itself.
  const nextSlug =
    columns.title && columns.title !== existing.title
      ? await slugForShow(columns.title, id)
      : undefined;

  if (Object.keys(columns).length > 0 || nextSlug) {
    await db
      .update(schema.shows)
      .set({ ...columns, ...(nextSlug ? { slug: nextSlug } : {}) })
      .where(eq(schema.shows.id, id));

    await writeAudit({
      actorId: guard.user.id,
      action: "show.update",
      targetType: "show",
      targetId: id,
      meta: {
        fields: Object.keys(columns),
        title: existing.title,
        ...(nextSlug ? { slugFrom: existing.slug, slugTo: nextSlug } : {}),
      },
    });
  }

  /*
   * The schedule carries a copy of the title, so a rename has to reach it.
   *
   * `epg_slots.title` is denormalised on purpose: the grid is read on every
   * page load and the slot has to render without a join. Nothing kept it in
   * step, so renaming a show left the old name on /schedule, on the week grid
   * and in the strip under the player, on every surface, until somebody edited
   * the slot by hand. The same goes for the pillar, which decides which filter
   * a slot appears under.
   *
   * Only the fields that were actually in the body: a save that did not touch
   * the title must not overwrite a slot title an operator set deliberately.
   */
  const slotSync: { title?: string; pillar?: typeof existing.pillar } = {};
  if (columns.title && columns.title !== existing.title) {
    slotSync.title = columns.title;
  }
  if ("pillar" in columns && columns.pillar !== existing.pillar) {
    slotSync.pillar = columns.pillar ?? null;
  }
  if (Object.keys(slotSync).length > 0) {
    await db
      .update(schema.epgSlots)
      .set(slotSync)
      .where(eq(schema.epgSlots.showId, id));
  }

  if (priceWindows) {
    await replacePriceWindows(id, priceWindows);
  }

  // `endedAt` and the release date both change the answer, and so does an
  // episode landing, so this runs on every save rather than only when the
  // relevant field was in the body.
  await refreshShowStatus(id);

  const updated = (
    await db.select().from(schema.shows).where(eq(schema.shows.id, id)).limit(1)
  )[0];
  return NextResponse.json({ show: updated });
}

/**
 * DELETE /api/admin/shows/[id] - soft delete.
 *
 * Sets `deletedAt` and stops there. Episodes keep their own `deletedAt` null:
 * every public read reaches an episode through its show, so hiding the show
 * hides them, and leaving them alone is what makes an undelete a single UPDATE
 * rather than a guess about which episodes were already pulled.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const show = (
    await db.select().from(schema.shows).where(eq(schema.shows.id, id)).limit(1)
  )[0];
  if (!show) return new NextResponse("Show not found", { status: 404 });
  if (show.deletedAt) {
    return NextResponse.json({ error: "Already deleted" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  await db
    .update(schema.shows)
    .set({ deletedAt: nowIso })
    .where(eq(schema.shows.id, id));

  await writeAudit({
    actorId: guard.user.id,
    action: "show.delete",
    targetType: "show",
    targetId: id,
    meta: { role: guard.role, title: show.title, slug: show.slug },
  });

  return NextResponse.json({ ok: true, showId: id, deletedAt: nowIso });
}
