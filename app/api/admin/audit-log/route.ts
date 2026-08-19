import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq, gte, like, lte, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/api/admin";

const querySchema = z.object({
  actorId: z.string().optional(),
  /** The role the actor held at the time, not the one they hold now. */
  actorRole: z.string().optional(),
  /** One room: editorial, broadcast, commerce, community, roster. */
  capability: z.string().optional(),
  /** Action prefix or namespace, matches with LIKE. */
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  /** ISO date inclusive lower bound. */
  fromDate: z.string().optional(),
  /** ISO date inclusive upper bound. */
  toDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function buildFilters(parsed: z.infer<typeof querySchema>): SQL[] {
  const f: SQL[] = [];
  if (parsed.actorId) f.push(eq(schema.auditLog.actorId, parsed.actorId));
  if (parsed.actorRole) f.push(eq(schema.auditLog.actorRole, parsed.actorRole));
  if (parsed.capability)
    f.push(eq(schema.auditLog.capability, parsed.capability));
  if (parsed.action) f.push(like(schema.auditLog.action, `${parsed.action}%`));
  if (parsed.targetType)
    f.push(eq(schema.auditLog.targetType, parsed.targetType));
  if (parsed.targetId) f.push(eq(schema.auditLog.targetId, parsed.targetId));
  if (parsed.fromDate) f.push(gte(schema.auditLog.createdAt, parsed.fromDate));
  if (parsed.toDate) f.push(lte(schema.auditLog.createdAt, parsed.toDate));
  return f;
}

/**
 * GET /api/admin/audit-log
 *
 * Filters:
 *   ?actorId=<userId>         - only actions by this admin
 *   ?actorRole=<role>         - only actions taken while holding that role
 *   ?capability=<room>        - one room: editorial, broadcast, commerce, ...
 *   ?action=<prefix>          - action namespace (e.g. "stream.")
 *   ?targetType=<type>        - only this target type
 *   ?targetId=<id>            - only this exact target row
 *   ?fromDate=<iso>           - created on/after
 *   ?toDate=<iso>             - created on/before
 *   ?limit=<n>&offset=<n>     - paging
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const filters = buildFilters(parsed.data);
  const whereClause = filters.length ? and(...filters) : undefined;
  const { limit, offset } = parsed.data;

  /*
   * Joined to the actor, because a log of ids is not a log anybody reads. The
   * name is looked up now rather than copied at write time: somebody who
   * changes their display name has not changed what they did.
   */
  const rows = await db
    .select({
      id: schema.auditLog.id,
      actorId: schema.auditLog.actorId,
      actorName: schema.user.name,
      actorEmail: schema.user.email,
      actorRole: schema.auditLog.actorRole,
      capability: schema.auditLog.capability,
      action: schema.auditLog.action,
      targetType: schema.auditLog.targetType,
      targetId: schema.auditLog.targetId,
      before: schema.auditLog.before,
      after: schema.auditLog.after,
      ip: schema.auditLog.ip,
      userAgent: schema.auditLog.userAgent,
      meta: schema.auditLog.meta,
      createdAt: schema.auditLog.createdAt,
    })
    .from(schema.auditLog)
    .leftJoin(schema.user, eq(schema.user.id, schema.auditLog.actorId))
    .where(whereClause as ReturnType<typeof and>)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(limit)
    .offset(offset);

  return NextResponse.json(rows);
}
