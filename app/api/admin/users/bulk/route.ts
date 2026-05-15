import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { canGrantRole, type PlatformRole } from "@/lib/auth/roles";

const PLATFORM_ROLES: [PlatformRole, ...PlatformRole[]] = [
  "guest",
  "user",
  "premium",
  "support_admin",
  "moderator",
  "finance_admin",
  "admin",
  "head_admin",
];

const bulkSchema = z.object({
  userIds: z.array(z.string()).min(1).max(100),
  role: z.enum(PLATFORM_ROLES),
});

/**
 * POST /api/admin/users/bulk
 *
 * Set the same role on a batch of users. Self-edit + canGrantRole checks
 * apply per-row; rejected rows are reported back. One audit row per
 * actually-updated user.
 */
export async function POST(req: NextRequest) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;

  const parsed = bulkSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { userIds, role: targetRole } = parsed.data;

  if (!canGrantRole(guard.role, targetRole)) {
    return NextResponse.json(
      { error: `Role ${guard.role} cannot grant ${targetRole}` },
      { status: 403 },
    );
  }

  const rows = await db
    .select({ id: schema.user.id, role: schema.user.role })
    .from(schema.user)
    .where(inArray(schema.user.id, userIds));

  const updated: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const row of rows) {
    if (row.id === guard.user.id) {
      skipped.push({ id: row.id, reason: "self" });
      continue;
    }
    const currentRole = (row.role ?? "user") as PlatformRole;
    if (!canGrantRole(guard.role, currentRole)) {
      skipped.push({ id: row.id, reason: `cannot modify ${currentRole}` });
      continue;
    }
    if (currentRole === targetRole) {
      skipped.push({ id: row.id, reason: "noop" });
      continue;
    }
    await db
      .update(schema.user)
      .set({ role: targetRole })
      .where(eq(schema.user.id, row.id));
    await writeAudit({
      actorId: guard.user.id,
      action: "role.grant",
      targetType: "user",
      targetId: row.id,
      meta: {
        actorRole: guard.role,
        previousRole: currentRole,
        newRole: targetRole,
        bulk: true,
      },
    });
    updated.push(row.id);
  }

  return NextResponse.json({
    ok: true,
    updatedCount: updated.length,
    skippedCount: skipped.length + (userIds.length - rows.length),
    skipped: [
      ...skipped,
      ...userIds
        .filter((id) => !rows.find((r) => r.id === id))
        .map((id) => ({ id, reason: "not_found" })),
    ],
  });
}
