import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { toProfile } from "@/lib/api/users";
import { requireCapability } from "@/lib/api/admin";
import { requireMinRole } from "@/lib/auth/guards";
import { canGrantRole, roleRank, type PlatformRole } from "@/lib/auth/roles";
import { writeAudit } from "@/lib/api/audit";
import { LAST_ADMIN_MESSAGE, wouldEmptyAdminRoster } from "@/lib/api/admin-roster";

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
  // Reading the account list is a support action: finding the person who wrote
  // in is the first step of every ticket. Changing a role is not, and PATCH
  // below still requires admin.
  const guard = await requireMinRole("support_admin");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { role, search, limit, offset } = parsed.data;

  const filters = [
    role ? eq(schema.user.role, role) : undefined,
    // `name` was missing here, so searching for somebody by the name shown on
    // screen found nothing.
    search
      ? or(
          ilike(schema.user.email, `%${search}%`),
          ilike(schema.user.handle, `%${search}%`),
          ilike(schema.user.name, `%${search}%`),
        )
      : undefined,
  ].filter(Boolean) as Parameters<typeof and>;

  const whereClause = filters.length ? and(...filters) : undefined;

  /**
   * Joined against `profiles`, which is where the app keeps the display name,
   * the uploaded avatar, the bio and the country. This endpoint used to select
   * the Better-Auth `user` columns alone and hand them back raw, so the admin
   * table received `name`/`image` while it renders `displayName`/`avatarUrl`,
   * and every row drew a blank name over a bare "@" with a placeholder avatar.
   *
   * `toProfile` is the same mapper the public profile pages use, so the two
   * cannot disagree again, and it carries the fallback chain (handle from the
   * email local part, name from any of three columns) that keeps a row
   * readable even when the profile is half filled in.
   */
  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(schema.user)
      .leftJoin(schema.profiles, eq(schema.user.id, schema.profiles.userId))
      .where(whereClause as ReturnType<typeof and>)
      .orderBy(desc(schema.user.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(schema.user)
      .where(whereClause as ReturnType<typeof and>),
  ]);

  const ids = rows.map((r) => r.user.id);

  /**
   * "Last active" was the account's creation date wearing a different label,
   * which made every account look equally stale. It is the newest login event
   * now, and null when the account has never signed in since the table
   * existed - an honest blank rather than a wrong date.
   */
  const lastActive = new Map<string, string>();
  const suspended = new Set<string>();
  const loginCountry = new Map<string, string>();

  if (ids.length > 0) {
    const [events, sanctions] = await Promise.all([
      db
        .select({
          userId: schema.loginEvents.userId,
          createdAt: sql<string>`max(${schema.loginEvents.createdAt})`,
          region: sql<string | null>`max(${schema.loginEvents.region})`,
        })
        .from(schema.loginEvents)
        .where(inArray(schema.loginEvents.userId, ids))
        .groupBy(schema.loginEvents.userId),
      db
        .select({
          userId: schema.userSanctions.userId,
          kind: schema.userSanctions.kind,
          expiresAt: schema.userSanctions.expiresAt,
        })
        .from(schema.userSanctions)
        .where(
          and(
            inArray(schema.userSanctions.userId, ids),
            isNull(schema.userSanctions.revertedAt),
          ),
        ),
    ]);

    for (const e of events) {
      if (e.createdAt) lastActive.set(e.userId, e.createdAt);
      if (e.region) loginCountry.set(e.userId, e.region);
    }

    const now = Date.now();
    for (const s of sanctions) {
      if (s.kind !== "suspended" && s.kind !== "banned") continue;
      // An expired sanction is not an active one, and nothing sweeps the table.
      if (s.expiresAt && new Date(s.expiresAt).getTime() <= now) continue;
      suspended.add(s.userId);
    }
  }

  const users = rows.map((r) => {
    const profile = toProfile(r.user, r.profiles);
    return {
      ...profile,
      // Admin-only fields. Not on `Profile`, because they are not public.
      email: r.user.email,
      emailVerified: r.user.emailVerified,
      // The country is on the profile only once somebody has filled it in.
      // Falling back to where they actually signed in from beats "NG" for all.
      country: r.profiles?.country || loginCountry.get(r.user.id) || "",
      suspended: suspended.has(r.user.id),
      lastActive: lastActive.get(r.user.id) ?? null,
      deletedAt: r.user.deletedAt
        ? new Date(r.user.deletedAt).toISOString()
        : null,
    };
  });

  return NextResponse.json({
    users,
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
 * Body: { userId, role } - promote/demote a user.
 *
 * Auth: requires `admin` or higher. `canGrantRole(actor, target)` further
 * restricts: head_admin can grant any role; an admin can grant anything up to
 * its own tier, which now includes `admin` itself, but never head_admin and
 * never guest.
 *
 * Self-edit blocked, and the last top-level admin cannot be demoted: with no
 * admins left nobody can promote anybody, and the only way back is a hand-
 * written UPDATE against production Postgres.
 *
 * Every successful change writes an audit row.
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

  // Self-edit is already blocked above, so an admin demoting someone else
  // always leaves themselves. A head_admin demoting the last `admin` does not,
  // and neither does an admin acting on an account the head_admin has since
  // deleted. Counted rather than reasoned about.
  if (await wouldEmptyAdminRoster(userId, currentRole, targetRole)) {
    return NextResponse.json({ error: LAST_ADMIN_MESSAGE }, { status: 409 });
  }

  const result = await db
    .update(schema.user)
    .set({ role: targetRole })
    .where(eq(schema.user.id, userId))
    .returning({ id: schema.user.id, role: schema.user.role });

  if (result.length === 0) {
    return new NextResponse("User not found", { status: 404 });
  }

  // Both sides of the change, in the columns the log reads. Stashing them in
  // `meta` is why every role grant on production shows "no fields".
  await writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "roster",
    action: "role.grant",
    targetType: "user",
    targetId: userId,
    before: { role: currentRole },
    after: { role: targetRole },
  });

  return NextResponse.json({ ok: true, ...result[0] });
}
