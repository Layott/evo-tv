import "server-only";
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth, type SessionUser } from "./index";
import { revokeIdleWebSession } from "./idle";
import { db, schema } from "@/lib/db";
import { hasMinRole, type PlatformRole } from "./roles";

export async function getSession() {
  const h = await headers();
  // Browsers idle for three hours are signed out here, before Better-Auth
  // reads (and thereby refreshes) the same row. See `lib/auth/idle.ts`.
  await revokeIdleWebSession(h);
  return auth.api.getSession({ headers: h });
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (session?.user) return session.user;

  // No session - check for X-API-Key (server-to-server / external integration).
  const { authenticateApiKey } = await import("./api-key");
  return authenticateApiKey();
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Server Component guard. Redirects on failure.
 *
 * Uses the platform role ladder in `roles.ts`. Higher-ranked roles
 * automatically satisfy lower-ranked requirements (admin satisfies
 * moderator, head_admin satisfies admin, etc.).
 */
export async function requireRole(role: PlatformRole): Promise<SessionUser> {
  const user = await requireUser();
  const userRole = (user as SessionUser & { role?: string }).role ?? "user";
  if (hasMinRole(userRole, role)) return user;
  if (role === "premium") redirect("/upgrade");
  redirect("/home");
}

/**
 * API Route guard - non-redirecting variant.
 *
 * Returns either `{ ok: true, user, role }` for success or `{ ok: false, response }`
 * with a 401/403 NextResponse ready to be returned from the route handler.
 */
export type PlatformGuardOk = {
  ok: true;
  user: SessionUser;
  role: PlatformRole;
};

export type PlatformGuardFail = {
  ok: false;
  response: NextResponse;
};

export type PlatformGuardResult = PlatformGuardOk | PlatformGuardFail;

export async function requireMinRole(
  minRole: PlatformRole,
): Promise<PlatformGuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: new NextResponse("Auth required", { status: 401 }),
    };
  }
  const role = ((user as SessionUser & { role?: string }).role ?? "user") as PlatformRole;
  if (!hasMinRole(role, minRole)) {
    return {
      ok: false,
      response: new NextResponse(
        `Requires ${minRole} role (you are ${role})`,
        { status: 403 },
      ),
    };
  }
  return { ok: true, user, role };
}

/**
 * Publisher-scoped RBAC.
 *
 * Resolves the publisher from a channelId, then checks the caller's
 * publisher_members.role against `minRole`. App-level admin
 * (`user.role === "admin"`) bypasses publisher checks.
 *
 * Returns the resolved publisher + caller's effective role, or a
 * NextResponse on 401 / 403 / 404 so call sites can `return guard.response`
 * directly.
 */
export type PublisherRole = "owner" | "admin" | "editor" | "viewer";

const ROLE_RANK: Record<PublisherRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4,
};

export type PublisherGuardOk = {
  ok: true;
  user: SessionUser;
  publisherId: string;
  channelId: string;
  role: PublisherRole | "evotv_admin";
};

export type PublisherGuardFail = {
  ok: false;
  response: NextResponse;
};

export type PublisherGuardResult = PublisherGuardOk | PublisherGuardFail;

export async function requirePublisherRoleByChannel(
  channelId: string,
  minRole: PublisherRole,
): Promise<PublisherGuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: new NextResponse("Auth required", { status: 401 }),
    };
  }

  const channel = (
    await db
      .select({ id: schema.channels.id, publisherId: schema.channels.publisherId })
      .from(schema.channels)
      .where(eq(schema.channels.id, channelId))
      .limit(1)
  )[0];
  if (!channel) {
    return {
      ok: false,
      response: new NextResponse("Channel not found", { status: 404 }),
    };
  }

  const appRole = (user as SessionUser & { role?: string }).role ?? "user";
  if (hasMinRole(appRole, "admin")) {
    return {
      ok: true,
      user,
      publisherId: channel.publisherId,
      channelId: channel.id,
      role: "evotv_admin",
    };
  }

  const membership = (
    await db
      .select({ role: schema.publisherMembers.role })
      .from(schema.publisherMembers)
      .where(
        and(
          eq(schema.publisherMembers.publisherId, channel.publisherId),
          eq(schema.publisherMembers.userId, user.id),
        ),
      )
      .limit(1)
  )[0];

  if (!membership) {
    return {
      ok: false,
      response: new NextResponse("Not a member of this publisher", { status: 403 }),
    };
  }

  const callerRole = membership.role as PublisherRole;
  if (ROLE_RANK[callerRole] < ROLE_RANK[minRole]) {
    return {
      ok: false,
      response: new NextResponse(
        `Requires ${minRole} role (you are ${callerRole})`,
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    user,
    publisherId: channel.publisherId,
    channelId: channel.id,
    role: callerRole,
  };
}

/**
 * Same as `requirePublisherRoleByChannel` but resolves by publisherId directly
 * (no channel involved - useful for publisher-level routes like /api/partner/[pubId]/members).
 */
export async function requirePublisherRole(
  publisherId: string,
  minRole: PublisherRole,
): Promise<PublisherGuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: new NextResponse("Auth required", { status: 401 }),
    };
  }

  const appRole = (user as SessionUser & { role?: string }).role ?? "user";
  if (hasMinRole(appRole, "admin")) {
    return {
      ok: true,
      user,
      publisherId,
      channelId: "",
      role: "evotv_admin",
    };
  }

  const membership = (
    await db
      .select({ role: schema.publisherMembers.role })
      .from(schema.publisherMembers)
      .where(
        and(
          eq(schema.publisherMembers.publisherId, publisherId),
          eq(schema.publisherMembers.userId, user.id),
        ),
      )
      .limit(1)
  )[0];

  if (!membership) {
    return {
      ok: false,
      response: new NextResponse("Not a member of this publisher", { status: 403 }),
    };
  }

  const callerRole = membership.role as PublisherRole;
  if (ROLE_RANK[callerRole] < ROLE_RANK[minRole]) {
    return {
      ok: false,
      response: new NextResponse(
        `Requires ${minRole} role (you are ${callerRole})`,
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    user,
    publisherId,
    channelId: "",
    role: callerRole,
  };
}
