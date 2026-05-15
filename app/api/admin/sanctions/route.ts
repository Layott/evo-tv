import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, gt, isNull, or, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";

const querySchema = z.object({
  kind: z.enum(["suspended", "banned", "chat_banned"]).optional(),
  /** 'active' = not reverted + not expired; 'all' = include reverted + expired. */
  status: z.enum(["active", "all"]).default("active"),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/sanctions
 *
 * Lists sanctions across all users. Default = active only. Enriches each row
 * with the target user's handle / email / image so the moderation queue can
 * render meaningful cards.
 *
 * Moderator+.
 */
export async function GET(req: NextRequest) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { kind, status, limit, offset } = parsed.data;

  const nowIso = new Date().toISOString();
  const filters: SQL[] = [];
  if (kind) filters.push(eq(schema.userSanctions.kind, kind));
  if (status === "active") {
    filters.push(isNull(schema.userSanctions.revertedAt));
    const expClause = or(
      isNull(schema.userSanctions.expiresAt),
      gt(schema.userSanctions.expiresAt, nowIso),
    );
    if (expClause) filters.push(expClause);
  }

  const whereClause = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: schema.userSanctions.id,
        userId: schema.userSanctions.userId,
        kind: schema.userSanctions.kind,
        reason: schema.userSanctions.reason,
        issuedBy: schema.userSanctions.issuedBy,
        expiresAt: schema.userSanctions.expiresAt,
        revertedAt: schema.userSanctions.revertedAt,
        revertedBy: schema.userSanctions.revertedBy,
        createdAt: schema.userSanctions.createdAt,
        userHandle: schema.user.handle,
        userEmail: schema.user.email,
        userName: schema.user.name,
        userImage: schema.user.image,
      })
      .from(schema.userSanctions)
      .innerJoin(schema.user, eq(schema.userSanctions.userId, schema.user.id))
      .where(whereClause as ReturnType<typeof and>)
      .orderBy(desc(schema.userSanctions.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(schema.userSanctions)
      .where(whereClause as ReturnType<typeof and>),
  ]);

  return NextResponse.json({
    sanctions: rows,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  });
}
