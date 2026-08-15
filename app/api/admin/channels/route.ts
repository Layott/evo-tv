import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";

const querySchema = z.object({
  suspended: z.enum(["only", "include"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/channels
 *
 * List ALL channels including suspended (admin-only - public listings hide
 * suspended). Filter via ?suspended=only / ?suspended=include.
 *
 * Moderator+ - admins suspend, mods view.
 */
export async function GET(req: NextRequest) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { suspended, limit, offset } = parsed.data;

  const filters: SQL[] = [];
  if (suspended === "only") filters.push(isNotNull(schema.channels.suspendedAt));
  if (suspended === undefined) filters.push(isNull(schema.channels.suspendedAt));

  const whereClause = filters.length ? and(...filters) : undefined;

  const baseQuery = db
    .select({
      id: schema.channels.id,
      slug: schema.channels.slug,
      name: schema.channels.name,
      description: schema.channels.description,
      logoUrl: schema.channels.logoUrl,
      category: schema.channels.category,
      isVerified: schema.channels.isVerified,
      isEvotvOwned: schema.channels.isEvotvOwned,
      followerCount: schema.channels.followerCount,
      publisherId: schema.channels.publisherId,
      publisherName: schema.publishers.name,
      suspendedAt: schema.channels.suspendedAt,
      suspendedReason: schema.channels.suspendedReason,
      createdAt: schema.channels.createdAt,
    })
    .from(schema.channels)
    .innerJoin(
      schema.publishers,
      eq(schema.channels.publisherId, schema.publishers.id),
    );

  const rows = whereClause
    ? await baseQuery
        .where(whereClause as ReturnType<typeof and>)
        .orderBy(desc(schema.channels.createdAt))
        .limit(limit)
        .offset(offset)
    : await baseQuery
        .orderBy(desc(schema.channels.createdAt))
        .limit(limit)
        .offset(offset);

  const [totalRow] = whereClause
    ? await db
        .select({ value: count() })
        .from(schema.channels)
        .where(whereClause as ReturnType<typeof and>)
    : await db.select({ value: count() }).from(schema.channels);

  return NextResponse.json({
    channels: rows,
    total: totalRow?.value ?? 0,
    limit,
    offset,
  });
}
