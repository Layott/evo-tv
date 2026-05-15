import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { activeSanctions, SANCTION_KINDS } from "@/lib/sanctions";

const createSchema = z.object({
  kind: z.enum(SANCTION_KINDS),
  reason: z.string().min(1).max(500),
  /** Seconds until expiry. Omit / null = permanent. */
  expiresInSec: z.number().int().positive().max(60 * 60 * 24 * 365).optional(),
});

/**
 * POST /api/admin/users/[id]/sanction
 *
 * Issue a sanction (suspended / banned / chat_banned). For `suspended` and
 * `banned`, also revokes all active sessions of the target user so they're
 * kicked immediately.
 *
 * Requires `moderator+` for chat_banned, `admin+` for suspended/banned.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetUserId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { kind, reason, expiresInSec } = parsed.data;

  const minRole = kind === "chat_banned" ? "moderator" : "admin";
  const guard = await requireMinRole(minRole);
  if (!guard.ok) return guard.response;

  if (guard.user.id === targetUserId) {
    return NextResponse.json(
      { error: "Cannot sanction yourself" },
      { status: 400 },
    );
  }

  const target = (
    await db.select().from(schema.user).where(eq(schema.user.id, targetUserId)).limit(1)
  )[0];
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Prevent lower-rank admin from sanctioning equal-or-higher-rank.
  const targetRole = (target as { role?: string }).role ?? "user";
  if (targetRole === "head_admin" || (targetRole === "admin" && guard.role !== "head_admin")) {
    return NextResponse.json(
      { error: `Cannot sanction a ${targetRole}` },
      { status: 403 },
    );
  }

  const existing = await activeSanctions(targetUserId);
  if (existing.some((s) => s.kind === kind)) {
    return NextResponse.json(
      { error: `User already has active ${kind} sanction` },
      { status: 409 },
    );
  }

  const nowMs = Date.now();
  const id = "san_" + crypto.randomBytes(8).toString("hex");
  const nowIso = new Date(nowMs).toISOString();
  const expiresIso = expiresInSec
    ? new Date(nowMs + expiresInSec * 1000).toISOString()
    : null;

  await db.insert(schema.userSanctions).values({
    id,
    userId: targetUserId,
    kind,
    reason,
    issuedBy: guard.user.id,
    expiresAt: expiresIso,
    revertedAt: null,
    revertedBy: null,
    createdAt: nowIso,
  });

  // Hard-kick: suspended/banned wipes all active sessions.
  let sessionsRevoked = 0;
  if (kind === "suspended" || kind === "banned") {
    const result = await db
      .delete(schema.session)
      .where(eq(schema.session.userId, targetUserId))
      .returning({ id: schema.session.id });
    sessionsRevoked = result.length;
  }

  await writeAudit({
    actorId: guard.user.id,
    action: `user.sanction.${kind}`,
    targetType: "user",
    targetId: targetUserId,
    meta: {
      role: guard.role,
      reason,
      expiresAt: expiresIso,
      sessionsRevoked,
      sanctionId: id,
    },
  });

  return NextResponse.json({
    ok: true,
    sanctionId: id,
    kind,
    expiresAt: expiresIso,
    sessionsRevoked,
  });
}

/**
 * GET /api/admin/users/[id]/sanction
 *
 * Returns all sanctions for a user (active + historical) ordered newest first.
 * Requires `moderator+`.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;
  const { id: targetUserId } = await params;

  const rows = await db
    .select()
    .from(schema.userSanctions)
    .where(eq(schema.userSanctions.userId, targetUserId))
    .orderBy(schema.userSanctions.createdAt);

  return NextResponse.json({ sanctions: rows.reverse() });
}
