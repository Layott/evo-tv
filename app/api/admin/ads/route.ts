import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  generateId,
  mapSqliteUniqueError,
  requireCapability,
  writeAudit,
} from "@/lib/api/admin";

const createSchema = z.object({
  placement: z.enum(["home_banner", "stream_preroll", "mid_roll", "live_filler", "sidebar", "between_content"]),
  mediaUrl: z.string(),
  clickUrl: z.string(),
  advertiser: z.string().min(1).max(200),
  active: z.boolean(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  weight: z.number().int().nonnegative(),
});

const listQuerySchema = z.object({
  placement: z
    .enum(["home_banner", "stream_preroll", "mid_roll", "live_filler", "sidebar", "between_content"])
    .optional(),
  active: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/ads
 *
 * Optional filters: ?placement=&active=true|false&limit=&offset=
 */
export async function GET(req: NextRequest) {
  const guard = await requireCapability("commerce");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { placement, active, limit, offset } = parsed.data;

  const filters = [
    placement ? eq(schema.ads.placement, placement) : undefined,
    typeof active === "boolean" ? eq(schema.ads.active, active) : undefined,
  ].filter(Boolean) as Parameters<typeof and>;

  const whereClause = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(schema.ads)
      .where(whereClause as ReturnType<typeof and>)
      .orderBy(desc(schema.ads.startAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(schema.ads)
      .where(whereClause as ReturnType<typeof and>),
  ]);

  return NextResponse.json({
    ads: rows,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireCapability("commerce");
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

  const id = generateId("ad");
  try {
    await db.insert(schema.ads).values({ id, ...parsed.data });
  } catch (err) {
    const conflict = mapSqliteUniqueError(err);
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to create ad" }, { status: 500 });
  }

  writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "commerce",
    action: "create",
    targetType: "ad",
    targetId: id,
    meta: parsed.data as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ id, ...parsed.data }, { status: 201 });
}
