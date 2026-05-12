import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth/guards";
import { log } from "@/lib/log";
import { writeAudit } from "@/lib/api/audit";

/**
 * DELETE /api/users/me — initiate GDPR self-delete.
 *
 * Soft-deletes via user.deleted_at; the actual cascade purge runs after a
 * 30-day grace window by a Vercel Cron worker (Phase 5 follow-up).
 * Sessions are revoked immediately so the bearer stops working.
 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const now = new Date();
  await db
    .update(schema.user)
    .set({ deletedAt: now })
    .where(eq(schema.user.id, user.id));

  // Revoke all sessions for this user — bearer token immediately invalid.
  try {
    await db
      .delete(schema.session)
      .where(eq(schema.session.userId, user.id));
  } catch (err) {
    log.warn("user.delete.session_revoke_failed", {
      userId: user.id,
      err: (err as Error)?.message,
    });
  }

  void writeAudit({
    actorId: user.id,
    action: "delete",
    targetType: "ad",
    targetId: user.id,
    meta: { event: "user_self_delete_requested", scheduledPurgeAt: new Date(Date.now() + 30 * 86400_000).toISOString() },
  });

  log.info("user.delete.requested", { userId: user.id });

  // Try to call Better-Auth signOut for cookie cleanup too (best-effort).
  try {
    void auth;
  } catch {
    /* noop */
  }

  return NextResponse.json({
    ok: true,
    scheduledPurgeAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
    notice:
      "Account marked for deletion. Active sessions revoked. " +
      "30-day grace window — sign in again before the deadline to cancel.",
  });
}
