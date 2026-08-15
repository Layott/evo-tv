import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { canGrantRole, type PlatformRole } from "@/lib/auth/roles";
import { LAST_ADMIN_MESSAGE, wouldEmptyAdminRoster } from "@/lib/api/admin-roster";

/**
 * Grant a role to someone by email.
 *
 * PATCH /api/admin/users takes a user id, which the roster screen only has for
 * accounts already on the page. Adding an admin usually starts from an email
 * address someone was given, and paging through the whole user list to find it
 * is not a workflow.
 *
 * This does NOT invite: the person must already have an account. Creating a
 * shell row here would mint an admin account with no password and no verified
 * email, which is a worse door than the one it opens.
 */

const PLATFORM_ROLES: [PlatformRole, ...PlatformRole[]] = [
  "user",
  "premium",
  "creator",
  "support_admin",
  "moderator",
  "finance_admin",
  "admin",
  "head_admin",
];

const bodySchema = z.object({
  email: z.string().trim().email().max(320),
  role: z.enum(PLATFORM_ROLES),
});

export async function POST(req: NextRequest) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { email, role: targetRole } = parsed.data;

  if (!canGrantRole(guard.role, targetRole)) {
    return NextResponse.json(
      { error: `Role ${guard.role} cannot grant ${targetRole}` },
      { status: 403 },
    );
  }

  // Addresses are stored as typed, so a lookup on the raw string misses
  // `Ada@evotv.co` for an account signed up as `ada@evotv.co`. Someone reading
  // an email address off a phone screen types whichever they see.
  const target = (
    await db
      .select({
        id: schema.user.id,
        email: schema.user.email,
        role: schema.user.role,
        deletedAt: schema.user.deletedAt,
      })
      .from(schema.user)
      .where(sql`lower(${schema.user.email}) = ${email.toLowerCase()}`)
      .limit(1)
  )[0];

  if (!target) {
    return NextResponse.json(
      {
        error: `No account for ${email}. They need to sign up first, then you can grant the role.`,
      },
      { status: 404 },
    );
  }
  if (target.deletedAt) {
    return NextResponse.json(
      { error: `The account for ${email} is deleted and cannot hold a role.` },
      { status: 409 },
    );
  }
  if (target.id === guard.user.id) {
    return NextResponse.json(
      { error: "You cannot change your own role" },
      { status: 400 },
    );
  }

  const currentRole = (target.role ?? "user") as PlatformRole;
  if (!canGrantRole(guard.role, currentRole)) {
    return NextResponse.json(
      { error: `Cannot modify a ${currentRole} (you are ${guard.role})` },
      { status: 403 },
    );
  }
  if (currentRole === targetRole) {
    return NextResponse.json({
      ok: true,
      id: target.id,
      email: target.email,
      role: targetRole,
      unchanged: true,
    });
  }
  if (await wouldEmptyAdminRoster(target.id, currentRole, targetRole)) {
    return NextResponse.json({ error: LAST_ADMIN_MESSAGE }, { status: 409 });
  }

  await db
    .update(schema.user)
    .set({ role: targetRole })
    .where(eq(schema.user.id, target.id));

  await writeAudit({
    actorId: guard.user.id,
    action: "role.grant",
    targetType: "user",
    targetId: target.id,
    meta: {
      actorRole: guard.role,
      previousRole: currentRole,
      newRole: targetRole,
      byEmail: true,
    },
  });

  return NextResponse.json({
    ok: true,
    id: target.id,
    email: target.email,
    role: targetRole,
  });
}
