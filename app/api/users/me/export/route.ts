import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

/**
 * GET /api/users/me/export - GDPR / NDPR data export.
 *
 * Returns a JSON dump of everything we hold on the calling user across the
 * tables they have rows in. Streams data in one shot - fine for typical
 * users with a few hundred rows total; would chunk if we ever cross
 * tens-of-thousands.
 *
 * Content-Disposition asks browsers to download it as `evotv-export-<id>.json`.
 *
 * Pairs with self-delete (DELETE /api/users/me, 30-day GDPR grace).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const userId = user.id;

  const [
    profile,
    vodProgress,
    bookmarks,
    orders,
    tips,
    predictions,
    pickemEntries,
    notifications,
    apiKeys,
    follows,
    auditTrail,
    sessions,
  ] = await Promise.all([
    db
      .select({
        id: schema.user.id,
        email: schema.user.email,
        name: schema.user.name,
        handle: schema.user.handle,
        image: schema.user.image,
        role: schema.user.role,
        emailVerified: schema.user.emailVerified,
        createdAt: schema.user.createdAt,
        updatedAt: schema.user.updatedAt,
      })
      .from(schema.user)
      .where(eq(schema.user.id, userId))
      .limit(1),
    db
      .select()
      .from(schema.vodProgress)
      .where(eq(schema.vodProgress.userId, userId)),
    db
      .select()
      .from(schema.vodBookmarks)
      .where(eq(schema.vodBookmarks.userId, userId))
      .orderBy(desc(schema.vodBookmarks.createdAt)),
    db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.userId, userId))
      .orderBy(desc(schema.orders.createdAt)),
    db.select().from(schema.tips).where(eq(schema.tips.fromUserId, userId)),
    db
      .select()
      .from(schema.predictionPicks)
      .where(eq(schema.predictionPicks.userId, userId)),
    db
      .select()
      .from(schema.pickemEntries)
      .where(eq(schema.pickemEntries.userId, userId)),
    db
      .select()
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, userId))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(500),
    db
      .select({
        id: schema.apiKeys.id,
        name: schema.apiKeys.name,
        prefix: schema.apiKeys.prefix,
        createdAt: schema.apiKeys.createdAt,
        revokedAt: schema.apiKeys.revokedAt,
        lastUsedAt: schema.apiKeys.lastUsedAt,
      })
      .from(schema.apiKeys)
      .where(eq(schema.apiKeys.userId, userId)),
    db
      .select()
      .from(schema.follows)
      .where(eq(schema.follows.userId, userId)),
    db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.actorId, userId))
      .orderBy(desc(schema.auditLog.createdAt))
      .limit(500),
    db
      .select({
        id: schema.session.id,
        createdAt: schema.session.createdAt,
        expiresAt: schema.session.expiresAt,
        ipAddress: schema.session.ipAddress,
        userAgent: schema.session.userAgent,
      })
      .from(schema.session)
      .where(eq(schema.session.userId, userId)),
  ]);

  const body = {
    exportedAt: new Date().toISOString(),
    userId,
    profile: profile[0] ?? null,
    vodProgress,
    bookmarks,
    orders,
    tips,
    predictions,
    pickemEntries,
    notifications,
    apiKeys,
    follows,
    auditTrail,
    sessions,
  };

  const filename = `evotv-export-${userId}-${Date.now()}.json`;
  return new NextResponse(JSON.stringify(body, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
