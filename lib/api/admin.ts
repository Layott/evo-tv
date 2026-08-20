import "server-only";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { hasMinRole } from "@/lib/auth/roles";
import { eq } from "drizzle-orm";
import { hasCapability, type Capability } from "@/lib/auth/capabilities";
import type { SessionUser } from "@/lib/auth";
import { sectionForAudit } from "@/lib/api/audit-section";

export type AdminGuardOk = {
  ok: true;
  user: SessionUser;
  /**
   * The role as the database holds it, not as the session remembers it.
   *
   * Every audit row records this, so the log says which hat somebody was
   * wearing when they acted rather than only who they were.
   */
  role: string;
};
export type AdminGuardFail = { ok: false; response: NextResponse };
export type AdminGuardResult = AdminGuardOk | AdminGuardFail;

/**
 * Ensure the current request is from a logged-in admin. On failure, returns a
 * 403 NextResponse wrapped in the result so the caller can return it directly.
 *
 * Compares on the ladder, not with `role !== "admin"`. That equality check was
 * false for a **head_admin**, so the highest role on the platform was refused
 * by every write route that uses this guard: creating a show, uploading a file,
 * editing the catalogue, publishing a VOD. The role could hand out roles and
 * could not publish anything.
 */
export async function requireAdminFromRequest(): Promise<AdminGuardResult> {
  const user = await getCurrentUser();
  // The live role, not the one stamped into the session when they signed in.
  const role = user ? await currentRole(user.id) : null;
  if (!user || !hasMinRole(role, "admin")) {
    return {
      ok: false,
      response: new NextResponse("Admin required", { status: 403 }),
    };
  }
  return { ok: true, user, role: role ?? "user" };
}

/**
 * The role this account holds right now, read from the database.
 *
 * Better-Auth stamps the role into the session, so promoting somebody changed
 * nothing until they signed out and back in: the owner's own account showed
 * `user` on a screen it had just been made admin of. A room check that reads a
 * stale copy is worse than no check, because it is wrong in both directions,
 * so this asks the row.
 *
 * One indexed primary-key lookup per guarded request. API-key callers carry no
 * session at all and are answered the same way.
 */
export async function currentRole(userId: string): Promise<string | null> {
  const row = (
    await db
      .select({ role: schema.user.role, deletedAt: schema.user.deletedAt })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1)
  )[0];
  // A deleted account keeps its row until the purge runs. It holds nothing.
  if (!row || row.deletedAt) return null;
  return row.role;
}

/**
 * Ensure the caller may open a given room.
 *
 * Rooms are `capabilities.ts`; rank is not consulted. An admin holds every
 * room, so converting a route from `requireAdminFromRequest` to this never
 * takes access away from anybody who had it.
 */
export async function requireCapability(
  capability: Capability,
): Promise<AdminGuardResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: new NextResponse("Sign in required", { status: 401 }),
    };
  }
  const role = await currentRole(user.id);
  if (!hasCapability(role, capability)) {
    return {
      ok: false,
      response: new NextResponse(`${capability} access required`, {
        status: 403,
      }),
    };
  }
  return {
    ok: true,
    user: { ...user, role } as SessionUser,
    role: role ?? "user",
  };
}

/**
 * Generate a prefixed random id using crypto.getRandomValues (16 hex chars = 8 bytes).
 */
export function generateId(prefix: string): string {
  return (
    prefix +
    "_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * What was acted on. A free string rather than a union, because the log has to
 * be able to record a kind of record nobody thought of when this was written,
 * and a union that lags reality means those actions go unlogged.
 */
export type AuditTargetType = string;
export type AuditAction = string;

/**
 * The fields that actually changed, and what they were.
 *
 * A log that stores the whole row twice is unreadable and leaks columns nobody
 * asked about; one that stores only the new value cannot answer "what was it
 * before". This keeps the intersection: every key whose value moved, on both
 * sides.
 */
export function diffFields(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  if (!before || !after) return null;
  const b: Record<string, unknown> = {};
  const a: Record<string, unknown> = {};
  for (const key of Object.keys(after)) {
    const was = before[key];
    const now = after[key];
    if (JSON.stringify(was) === JSON.stringify(now)) continue;
    b[key] = was ?? null;
    a[key] = now ?? null;
  }
  return Object.keys(a).length > 0 ? { before: b, after: a } : null;
}

/**
 * Insert a row into audit_log. Best-effort: we wrap in try/catch so an audit
 * failure never blocks the underlying mutation response.
 */
export async function writeAudit(params: {
  actorId: string;
  /** The role held at the time. History does not move when somebody is promoted. */
  actorRole?: string | null;
  /** Which room this belonged to, so the log can be read one room at a time. */
  capability?: Capability | null;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  /** The record as it was, and as it became. Pass whole rows; only the changes are stored. */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const changed = diffFields(params.before, params.after);
    // Where the request came from. Behind Caddy the first hop is the client.
    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      const { headers } = await import("next/headers");
      const h = await headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null;
      userAgent = h.get("user-agent");
    } catch {
      // Outside a request (a cron job, a script). The action still gets logged.
    }
    await db.insert(schema.auditLog).values({
      id: generateId("audit"),
      actorId: params.actorId,
      actorRole: params.actorRole ?? (await currentRole(params.actorId)),
      capability:
        params.capability ??
        (sectionForAudit(params.action, params.targetType) as Capability | null),
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      before: changed?.before ?? null,
      after: changed?.after ?? null,
      ip,
      userAgent,
      meta: (params.meta ?? null) as Record<string, unknown> | null,
      createdAt: new Date().toISOString(),
    });
  } catch {
    // Swallow audit errors so they cannot break the primary mutation.
  }
}

/**
 * The same thing, with the actor and the room filled in from the guard.
 *
 * Every room route already holds its guard result, so this is the shape almost
 * every call site wants and the one that cannot forget to record the role.
 */
export async function auditFromGuard(
  guard: AdminGuardOk,
  capability: Capability,
  params: {
    action: AuditAction;
    targetType: AuditTargetType;
    targetId: string;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    meta?: Record<string, unknown> | null;
  },
): Promise<void> {
  await writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability,
    ...params,
  });
}

/**
 * Detect a SQLite UNIQUE-constraint collision and map it to a 409 response.
 * Returns `null` for other errors so the caller can re-raise / 500.
 */
export function mapSqliteUniqueError(err: unknown): NextResponse | null {
  const message =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message?: unknown }).message ?? "")
      : String(err);
  if (/UNIQUE constraint failed/i.test(message) || /duplicate key value violates unique constraint/i.test(message)) {
    return NextResponse.json(
      { error: "Unique constraint violation", detail: message },
      { status: 409 }
    );
  }
  return null;
}
