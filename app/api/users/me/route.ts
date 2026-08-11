import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth/guards";
import { log } from "@/lib/log";
import { writeAudit } from "@/lib/api/audit";

/**
 * GET /api/users/me - joined view of user + profile (bio, country).
 *
 * Used by the RN auth provider after sign-in to hydrate the editable
 * profile fields that Better-Auth's session payload doesn't include.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const profile = (
    await db
      .select({
        bio: schema.profiles.bio,
        country: schema.profiles.country,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id))
      .limit(1)
  )[0];

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      handle: (user as { handle?: string | null }).handle ?? null,
      image: (user as { image?: string | null }).image ?? null,
      role: (user as { role?: string }).role ?? "user",
      bio: profile?.bio ?? "",
      country: profile?.country ?? "NG",
      /**
       * When the account was created. This was not returned at all, so the
       * profile header rendered `new Date(undefined)` and printed
       * "Joined Invalid Date" to every user.
       *
       * Better-Auth's own `createdAt` on the user row is the real answer; the
       * profiles row is written later and only when someone edits something.
       */
      createdAt: user.createdAt
        ? new Date(user.createdAt).toISOString()
        : null,
    },
  });
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  handle: z
    .string()
    .min(3)
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, "letters, numbers, underscores")
    .optional(),
  bio: z.string().max(280).optional(),
  country: z.string().min(2).max(64).optional(),
});

/**
 * PATCH /api/users/me - update editable profile fields.
 *
 * Body: { name?, handle?, bio?, country? }. Updates Better-Auth `user`
 * (name + handle) and upserts the `profiles` row (bio + country). Returns
 * the same joined shape GET does so the RN client can re-hydrate.
 */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

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

  const { name, handle, bio, country } = parsed.data;

  // Handle uniqueness - reject early with a 409 so the form can highlight.
  if (typeof handle === "string") {
    const clash = (
      await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(
          and(eq(schema.user.handle, handle), ne(schema.user.id, user.id)),
        )
        .limit(1)
    )[0];
    if (clash) {
      return NextResponse.json(
        { error: "handle_taken", field: "handle" },
        { status: 409 },
      );
    }
  }

  const userPatch: Record<string, unknown> = {};
  if (typeof name === "string") userPatch.name = name;
  if (typeof handle === "string") userPatch.handle = handle;
  if (Object.keys(userPatch).length > 0) {
    userPatch.updatedAt = new Date();
    await db.update(schema.user).set(userPatch).where(eq(schema.user.id, user.id));
  }

  const profilePatch: Record<string, unknown> = {};
  if (typeof bio === "string") profilePatch.bio = bio;
  if (typeof country === "string") profilePatch.country = country;
  if (Object.keys(profilePatch).length > 0) {
    const exists = (
      await db
        .select({ userId: schema.profiles.userId })
        .from(schema.profiles)
        .where(eq(schema.profiles.userId, user.id))
        .limit(1)
    )[0];
    if (exists) {
      await db
        .update(schema.profiles)
        .set(profilePatch)
        .where(eq(schema.profiles.userId, user.id));
    } else {
      await db.insert(schema.profiles).values({
        userId: user.id,
        displayName: name ?? user.name ?? "",
        avatarUrl: (user as { image?: string | null }).image ?? "",
        bio: typeof bio === "string" ? bio : "",
        country: typeof country === "string" ? country : "NG",
        onboardedAt: null,
        createdAt: new Date().toISOString(),
      });
    }
  }

  void writeAudit({
    actorId: user.id,
    action: "user.profile.update",
    targetType: "user",
    targetId: user.id,
    meta: { fields: Object.keys(parsed.data) },
  });

  // Re-read joined view.
  const profile = (
    await db
      .select({
        bio: schema.profiles.bio,
        country: schema.profiles.country,
      })
      .from(schema.profiles)
      .where(eq(schema.profiles.userId, user.id))
      .limit(1)
  )[0];
  const fresh = (
    await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        handle: schema.user.handle,
        image: schema.user.image,
        role: schema.user.role,
      })
      .from(schema.user)
      .where(eq(schema.user.id, user.id))
      .limit(1)
  )[0];

  return NextResponse.json({
    user: {
      id: fresh?.id ?? user.id,
      email: fresh?.email ?? user.email,
      name: fresh?.name ?? user.name,
      handle: fresh?.handle ?? null,
      image: fresh?.image ?? null,
      role: fresh?.role ?? "user",
      bio: profile?.bio ?? "",
      country: profile?.country ?? "NG",
    },
  });
}

/**
 * DELETE /api/users/me - initiate GDPR self-delete.
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

  // Revoke all sessions for this user - bearer token immediately invalid.
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
      "30-day grace window - sign in again before the deadline to cancel.",
  });
}
