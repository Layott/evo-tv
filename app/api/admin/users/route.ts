import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { requireMinRole } from "@/lib/auth/guards";
import { canGrantRole, type PlatformRole } from "@/lib/auth/roles";
import { writeAudit } from "@/lib/api/audit";

const PLATFORM_ROLES: [PlatformRole, ...PlatformRole[]] = [
  "guest",
  "user",
  "premium",
  "creator",
  "support_admin",
  "moderator",
  "finance_admin",
  "admin",
  "head_admin",
];

const querySchema = z.object({
  role: z.enum(PLATFORM_ROLES).optional(),
  search: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/users
 *
 * Optional filters: ?role=&search=&limit=&offset=
 *   - search matches email or handle (case-insensitive)
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { role, search, limit, offset } = parsed.data;

  const filters = [
    role ? eq(schema.user.role, role) : undefined,
    search
      ? or(
          ilike(schema.user.email, `%${search}%`),
          ilike(schema.user.handle, `%${search}%`),
        )
      : undefined,
  ].filter(Boolean) as Parameters<typeof and>;

  const whereClause = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: schema.user.id,
        email: schema.user.email,
        name: schema.user.name,
        handle: schema.user.handle,
        role: schema.user.role,
        emailVerified: schema.user.emailVerified,
        image: schema.user.image,
        createdAt: schema.user.createdAt,
        deletedAt: schema.user.deletedAt,
      })
      .from(schema.user)
      .where(whereClause as ReturnType<typeof and>)
      .orderBy(desc(schema.user.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(schema.user)
      .where(whereClause as ReturnType<typeof and>),
  ]);

  return NextResponse.json({
    users: rows,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  });
}

const patchSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(PLATFORM_ROLES),
});

/**
 * PATCH /api/admin/users
 *
 * Body: { userId, role } — promote/demote a user.
 *
 * Auth: requires `admin` or higher. `canGrantRole(actor, target)` further
 * restricts: head_admin can grant any role; admin can grant
 * moderator/finance_admin/support_admin/user/premium (NOT admin/head_admin).
 * Cannot demote a higher- or equal-ranked role (no admin removing another
 * admin's privileges except head_admin).
 *
 * Self-edit blocked. Every successful change writes an audit row.
 */
export async function PATCH(req: NextRequest) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { userId, role: targetRole } = parsed.data;

  if (userId === guard.user.id) {
    return new NextResponse("Cannot change own role", { status: 400 });
  }

  // Actor must be allowed to grant this role.
  if (!canGrantRole(guard.role, targetRole)) {
    return NextResponse.json(
      { error: `Role ${guard.role} cannot grant ${targetRole}` },
      { status: 403 },
    );
  }

  // Look up current role on target user. Block lower-ranked actor from
  // demoting an equal-or-higher-ranked role (e.g. an admin cannot strip
  // head_admin from someone else; only another head_admin can).
  const target = (
    await db
      .select({ role: schema.user.role })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1)
  )[0];
  if (!target) {
    return new NextResponse("User not found", { status: 404 });
  }
  const currentRole = (target.role ?? "user") as PlatformRole;
  if (!canGrantRole(guard.role, currentRole)) {
    return NextResponse.json(
      { error: `Cannot modify a ${currentRole} (you are ${guard.role})` },
      { status: 403 },
    );
  }
  if (currentRole === targetRole) {
    return NextResponse.json({ ok: true, id: userId, role: targetRole });
  }

  const result = await db
    .update(schema.user)
    .set({ role: targetRole })
    .where(eq(schema.user.id, userId))
    .returning({ id: schema.user.id, role: schema.user.role });

  if (result.length === 0) {
    return new NextResponse("User not found", { status: 404 });
  }

  await writeAudit({
    actorId: guard.user.id,
    action: "role.grant",
    targetType: "user",
    targetId: userId,
    meta: {
      actorRole: guard.role,
      previousRole: currentRole,
      newRole: targetRole,
    },
  });

  return NextResponse.json({ ok: true, ...result[0] });
}
