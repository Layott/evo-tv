import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";

const bulkSchema = z.object({
  ids: z.array(z.string()).min(1).max(100),
  status: z.enum(["resolved", "dismissed"]),
  notes: z.string().max(2000).optional(),
});

/**
 * POST /api/admin/reports/bulk
 *
 * Resolve or dismiss multiple open reports at once. Skips rows that are not
 * currently `open` (no overwrite). Writes one audit row per affected report
 * so the trail stays granular. Moderator+.
 */
export async function POST(req: NextRequest) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const parsed = bulkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { ids, status, notes } = parsed.data;

  const open = await db
    .select()
    .from(schema.contentReports)
    .where(
      and(
        inArray(schema.contentReports.id, ids),
        eq(schema.contentReports.status, "open"),
      ),
    );

  if (open.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, skipped: ids.length });
  }

  const nowIso = new Date().toISOString();
  const openIds = open.map((r) => r.id);

  await db
    .update(schema.contentReports)
    .set({
      status,
      resolvedBy: guard.user.id,
      resolvedAt: nowIso,
      resolutionNotes: notes ?? null,
    })
    .where(inArray(schema.contentReports.id, openIds));

  for (const row of open) {
    await writeAudit({
      actorId: guard.user.id,
      action: `report.${status}`,
      targetType: "report",
      targetId: row.id,
      meta: {
        role: guard.role,
        bulk: true,
        reportTargetType: row.targetType,
        reportTargetId: row.targetId,
        category: row.category,
        notes,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    updated: open.length,
    skipped: ids.length - open.length,
  });
}
