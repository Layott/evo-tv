import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { generateId, requireCapability } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import { getShowById } from "@/lib/api/shows";
import { priceWindow, socialLink, urlOrPath } from "@/lib/api/shows-admin";
import { refreshShowStatus, replacePriceWindows } from "@/lib/api/show-state";
import { MAX_PRICE_WINDOWS } from "@/lib/shows/pricing";
import { slugForShow } from "@/lib/api/slugs";

const listQuerySchema = z.object({
  /** Free-text over title and slug. The admin list is small enough for ILIKE. */
  q: z.string().trim().max(200).optional(),
  pillar: z.enum(["esports", "anime", "lifestyle"]).optional(),
  status: z.enum(["airing", "completed", "upcoming", "hiatus"]).optional(),
  originType: z.enum(["evo_original", "licensed", "syndicated"]).optional(),
  deleted: z.enum(["only", "include"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/shows - admin list of shows (active + optional deleted).
 *
 *   ?deleted=only     -> only soft-deleted rows
 *   ?deleted=include  -> both
 *   (omitted)         -> active only (default)
 *
 * Moderator+ to read, matching the VOD admin list. Writes below are admin only.
 *
 * Rows come back raw rather than through `toShow`, because the CMS grid needs
 * `deletedAt` (to show what is in the bin) and the public mapper drops it.
 */
export async function GET(req: NextRequest) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { q, pillar, status, originType, deleted, limit, offset } = parsed.data;

  const filters = [
    q ? or(ilike(schema.shows.title, `%${q}%`), ilike(schema.shows.slug, `%${q}%`)) : undefined,
    pillar ? eq(schema.shows.pillar, pillar) : undefined,
    status ? eq(schema.shows.status, status) : undefined,
    originType ? eq(schema.shows.originType, originType) : undefined,
    deleted === "only"
      ? isNotNull(schema.shows.deletedAt)
      : deleted === "include"
        ? undefined
        : isNull(schema.shows.deletedAt),
  ].filter(Boolean) as Parameters<typeof and>;

  const whereClause = filters.length ? and(...filters) : undefined;

  const [shows, totalRow] = await Promise.all([
    db
      .select()
      .from(schema.shows)
      .where(whereClause as ReturnType<typeof and>)
      .orderBy(asc(schema.shows.title))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(schema.shows)
      .where(whereClause as ReturnType<typeof and>),
  ]);

  return NextResponse.json({
    shows,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  });
}

const createSchema = z.object({
  title: z.string().trim().min(2).max(200),
  synopsis: z.string().max(4000).default(""),
  pillar: z.enum(["esports", "anime", "lifestyle"]).nullish(),
  originType: z
    .enum(["evo_original", "licensed", "syndicated"])
    .default("evo_original"),
  primaryCreatorHandle: z.string().trim().max(100).default(""),
  socialLinks: z.array(socialLink).max(8).default([]),
  posterUrl: urlOrPath.default(""),
  heroUrl: urlOrPath.default(""),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  isPremium: z.boolean().default(false),
  priceWindows: z.array(priceWindow).max(MAX_PRICE_WINDOWS).default([]),
  maturityRating: z.enum(["kids", "pg", "teen", "mature"]).default("teen"),
  contentTags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  /** Null clears it. The column is nullable and the read mapper substitutes the epoch. */
  releasedAt: z.string().datetime().nullable().default(null),
  rating: z.number().min(0).max(10).default(0),
});

/**
 * Neither `slug` nor `status` is accepted from a client any more.
 *
 * The slug is the title, reduced. An editor typing a second, different name for
 * the same thing is how a show ends up reachable at a URL that says something
 * else, and the rule now holds across the site: a slug is derived from the name
 * it belongs to, never entered beside it.
 *
 * The status is derived from the episodes and the grid on every write. See
 * `lib/api/show-state.ts` for the rules.
 */

/**
 * POST /api/admin/shows - create a show.
 *
 * Counters start at zero and are maintained by `recountShow` as seasons and
 * episodes are added; nothing here invents them.
 *
 * Returns 201 with the show in the public `Show` shape, so the client can drop
 * it straight into the same list the read endpoints fill.
 */
export async function POST(req: NextRequest) {
  const guard = await requireCapability("editorial");
  if (!guard.ok) return guard.response;

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
  const input = parsed.data;

  // `slugForShow` already dodges collisions, so there is nothing to check and
  // nothing for an editor to get wrong.
  const slug = await slugForShow(input.title);
  const id = generateId("show");

  await db.insert(schema.shows).values({
    id,
    slug,
    title: input.title,
    synopsis: input.synopsis,
    heroUrl: input.heroUrl,
    posterUrl: input.posterUrl,
    pillar: input.pillar,
    originType: input.originType,
    // Corrected immediately below by the derivation. A brand new show with no
    // episodes and no slot is upcoming, which is what this says.
    status: "upcoming",
    primaryCreatorHandle: input.primaryCreatorHandle,
    socialLinks: input.socialLinks,
    totalSeasons: 0,
    totalEpisodes: 0,
    rating: input.rating,
    releasedAt: input.releasedAt,
    tags: input.tags,
    isPremium: input.isPremium,
    maturityRating: input.maturityRating,
    contentTags: input.contentTags,
  });

  if (input.isPremium && input.priceWindows.length > 0) {
    await replacePriceWindows(id, input.priceWindows);
  }
  await refreshShowStatus(id);

  await writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "editorial",
    action: "show.create",
    before: null,
    after: (await getShowById(id)) as unknown as Record<string, unknown>,
    targetType: "show",
    targetId: id,
    meta: { title: input.title, slug, isPremium: input.isPremium },
  });

  return NextResponse.json(await getShowById(id), { status: 201 });
}
