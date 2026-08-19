import "server-only";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { diffFields, generateId } from "@/lib/api/admin";

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

  const rows = whereClause
    ? await db
        .select()
        .from(schema.auditLog)
        .where(whereClause)
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(limit)
        .offset(offset)
    : await db
        .select()
        .from(schema.auditLog)
        .orderBy(desc(schema.auditLog.createdAt))
        .limit(limit)
        .offset(offset);

  const totalRow = whereClause
    ? (
        await db
          .select({ c: sql<number>`count(*)` })
          .from(schema.auditLog)
          .where(whereClause)
          .limit(1)
      )[0]
    : (
        await db
          .select({ c: sql<number>`count(*)` })
          .from(schema.auditLog)
          .limit(1)
      )[0];

  return { rows, total: Number(totalRow?.c ?? 0) };
}

/**
 * Write a row to `audit_log`. Unlike the best-effort helper in
 * `lib/api/admin.ts`, this one re-throws on failure so callers can decide
 * how to react.
 */
export async function writeAudit(params: {
  actorId: string | null;
  /** The role held at the time, so a later promotion cannot rewrite history. */
  actorRole?: string | null;
  /** Which room this belonged to. */
  capability?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  /** Whole rows; only the fields that moved are stored. */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
}): Promise<AuditRow> {
  const id = generateId("audit");
  const createdAt = new Date().toISOString();
  const changed = diffFields(params.before, params.after);
  await db
    .insert(schema.auditLog)
    .values({
      id,
      actorId: params.actorId,
      actorRole: params.actorRole ?? null,
      capability: params.capability ?? null,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      before: changed?.before ?? null,
      after: changed?.after ?? null,
      meta: (params.meta ?? null) as Record<string, unknown> | null,
      createdAt,
    });

  const row = (
    await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.id, id))
      .limit(1)
  )[0];
  if (!row) throw new Error("Audit insert disappeared");
  return row;
}
