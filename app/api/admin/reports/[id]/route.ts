import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";

const patchSchema = z.object({
  status: z.enum(["resolved", "dismissed"]),
  notes: z.string().max(2000).optional(),
});

/**
 * PATCH /api/admin/reports/[id]
 *
 * Resolve or dismiss a report. Sets resolvedBy/resolvedAt/resolutionNotes.
 * Once non-`open`, cannot be re-modified. Audits the action.
 *
 * Moderator+.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { status, notes } = parsed.data;

  const row = (
    await db
      .select()
      .from(schema.contentReports)
      .where(eq(schema.contentReports.id, id))
      .limit(1)
  )[0];
  if (!row) return new NextResponse("Report not found", { status: 404 });
  if (row.status !== "open") {
    return NextResponse.json(
      { error: `Report already ${row.status}` },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  await db
    .update(schema.contentReports)
    .set({
      status,
      resolvedBy: guard.user.id,
      resolvedAt: nowIso,
      resolutionNotes: notes ?? null,
    })
    .where(eq(schema.contentReports.id, id));

  await writeAudit({
    actorId: guard.user.id,
    action: `report.${status}`,
    targetType: "report",
    targetId: id,
    meta: {
      role: guard.role,
      reportTargetType: row.targetType,
      reportTargetId: row.targetId,
      category: row.category,
      notes,
    },
  });

  return NextResponse.json({ ok: true, reportId: id, status });
}
