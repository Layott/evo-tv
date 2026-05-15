import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, gte, like, lte, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/api/admin";

const querySchema = z.object({
  actorId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  targetId: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  /** Cap at 10k rows per export — anything larger requires paginated pulls. */
  limit: z.coerce.number().int().min(1).max(10_000).default(5_000),
});

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : JSON.stringify(value);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * GET /api/admin/audit-log/export
 *
 * Streams matching audit-log rows as CSV. Same filter shape as the JSON
 * endpoint. Caps at 10k rows per request. Content-Disposition prompts a
 * download in browsers; on RN we hand the URL to expo-sharing.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const filters: SQL[] = [];
  if (parsed.data.actorId) filters.push(eq(schema.auditLog.actorId, parsed.data.actorId));
  if (parsed.data.action)
    filters.push(like(schema.auditLog.action, `${parsed.data.action}%`));
  if (parsed.data.targetType)
    filters.push(eq(schema.auditLog.targetType, parsed.data.targetType));
  if (parsed.data.targetId)
    filters.push(eq(schema.auditLog.targetId, parsed.data.targetId));
  if (parsed.data.fromDate)
    filters.push(gte(schema.auditLog.createdAt, parsed.data.fromDate));
  if (parsed.data.toDate)
    filters.push(lte(schema.auditLog.createdAt, parsed.data.toDate));

  const whereClause = filters.length ? and(...filters) : undefined;

  const rows = await db
    .select()
    .from(schema.auditLog)
    .where(whereClause as ReturnType<typeof and>)
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(parsed.data.limit);

  const header = ["id", "createdAt", "actorId", "action", "targetType", "targetId", "meta"].join(
    ",",
  );
  const body = rows
    .map((r) =>
      [
        r.id,
        r.createdAt,
        r.actorId ?? "",
        r.action,
        r.targetType,
        r.targetId,
        r.meta ? csvEscape(r.meta) : "",
      ]
        .map((field, idx) => (idx === 6 ? field : csvEscape(field)))
        .join(","),
    )
    .join("\n");
  const csv = `${header}\n${body}\n`;

  const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
