import "server-only";
import { NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import type { SessionUser } from "@/lib/auth";

export type AdminGuardOk = { ok: true; user: SessionUser };
export type AdminGuardFail = { ok: false; response: NextResponse };
export type AdminGuardResult = AdminGuardOk | AdminGuardFail;

/**
 * Ensure the current request is from a logged-in admin. On failure, returns a
 * 403 NextResponse wrapped in the result so the caller can return it directly.
 */
export async function requireAdminFromRequest(): Promise<AdminGuardResult> {
  const user = await getCurrentUser();
  const role = (user as { role?: string } | null)?.role;
  if (!user || role !== "admin") {
    return {
      ok: false,
      response: new NextResponse("Admin required", { status: 403 }),
    };
  }
  return { ok: true, user };
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

export type AuditTargetType = "game" | "team" | "player" | "event" | "ad" | "stream";
export type AuditAction = "create" | "update" | "delete";

/**
 * Insert a row into audit_log. Best-effort: we wrap in try/catch so an audit
 * failure never blocks the underlying mutation response.
 */
export function writeAudit(params: {
  actorId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  meta?: Record<string, unknown> | null;
}): void {
  try {
    db.insert(schema.auditLog)
      .values({
        id: generateId("audit"),
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        meta: (params.meta ?? null) as Record<string, unknown> | null,
        createdAt: new Date().toISOString(),
      })
      .run();
  } catch {
    // Swallow audit errors so they cannot break the primary mutation.
  }
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
  if (/UNIQUE constraint failed/i.test(message)) {
    return NextResponse.json(
      { error: "Unique constraint violation", detail: message },
      { status: 409 }
    );
  }
  return null;
}
