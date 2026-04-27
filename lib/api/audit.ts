import "server-only";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { generateId } from "@/lib/api/admin";

export type AuditRow = typeof schema.auditLog.$inferSelect;

export interface ListAuditOptions {
  limit?: number;
  offset?: number;
  actorId?: string | null;
  targetType?: string;
}

export async function listAudit(
  opts: ListAuditOptions = {}
): Promise<{ rows: AuditRow[]; total: number }> {
  const limit = Math.max(1, Math.min(500, Math.trunc(opts.limit ?? 100)));
  const offset = Math.max(0, Math.trunc(opts.offset ?? 0));

  const conds: SQL[] = [];
  if (opts.actorId) conds.push(eq(schema.auditLog.actorId, opts.actorId));
  if (opts.targetType)
    conds.push(eq(schema.auditLog.targetType, opts.targetType));

  const whereClause = conds.length > 0 ? and(...conds) : undefined;

  const rowsBase = db.select().from(schema.auditLog);
  const rows = whereClause
    ? rowsBase
        .where(whereClause)
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(limit)
        .offset(offset)
        .all()
    : rowsBase
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(limit)
        .offset(offset)
        .all();

  const totalBase = db
    .select({ c: sql<number>`count(*)` })
    .from(schema.auditLog);
  const totalRow = whereClause
    ? totalBase.where(whereClause).get()
    : totalBase.get();

  return { rows, total: Number(totalRow?.c ?? 0) };
}

/**
 * Write a row to `audit_log`. Unlike the best-effort helper in
 * `lib/api/admin.ts`, this one re-throws on failure so callers can decide
 * how to react.
 */
export async function writeAudit(params: {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  meta?: Record<string, unknown> | null;
}): Promise<AuditRow> {
  const id = generateId("audit");
  const createdAt = new Date().toISOString();
  db.insert(schema.auditLog)
    .values({
      id,
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      meta: (params.meta ?? null) as Record<string, unknown> | null,
      createdAt,
    })
    .run();

  const row = db
    .select()
    .from(schema.auditLog)
    .where(eq(schema.auditLog.id, id))
    .get();
  if (!row) throw new Error("Audit insert disappeared");
  return row;
}
