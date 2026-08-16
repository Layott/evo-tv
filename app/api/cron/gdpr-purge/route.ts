import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { writeAudit } from "@/lib/api/audit";

/**
 * Vercel Cron: weekly GDPR cascade purge.
 *
 * Droplet crontab: `cron.sh gdpr-purge`, 04:00 Sundays, Africa/Lagos.
 *
 * Walks `user` rows where `deletedAt` is set AND older than 30 days. For
 * each matching user:
 *
 *   1. Hard-delete personal-data rows: watch_events, prediction_picks,
 *      pickem_entries, vod_progress, party_messages, party_members,
 *      api_keys. (chat_messages cascades via FK on user delete.)
 *
 *   2. Anonymize the user row: handle = null, name = "Deleted user",
 *      image = null, email = `deleted-<id>@deleted.local`. The row stays
 *      so foreign-key references in audit_log / tips / orders remain valid.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}. Same shape as analytics +
 * payouts crons.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const cutoffIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // user.deletedAt is timestamptz, mode "date" - pass a Date directly.
  const candidates = await db
    .select({
      id: schema.user.id,
      email: schema.user.email,
    })
    .from(schema.user)
    .where(
      and(
        isNotNull(schema.user.deletedAt),
        lt(schema.user.deletedAt, cutoffIso),
      ),
    )
    .limit(50);

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, purged: 0 });
  }

  const purgedIds: string[] = [];
  for (const u of candidates) {
    try {
      // Hard-delete personal-data rows. chat_messages, vod_progress,
      // pickem_entries, prediction_picks, party_members, party_messages,
      // api_keys, watch_events all have FK onDelete cascade or no constraint -
      // but we explicitly DELETE to avoid relying on cascade behavior.
      await db.delete(schema.watchEvents).where(eq(schema.watchEvents.userId, u.id));
      await db.delete(schema.predictionPicks).where(eq(schema.predictionPicks.userId, u.id));
      await db.delete(schema.pickemEntries).where(eq(schema.pickemEntries.userId, u.id));
      await db.delete(schema.vodProgress).where(eq(schema.vodProgress.userId, u.id));
      await db.delete(schema.partyMessages).where(eq(schema.partyMessages.userId, u.id));
      await db.delete(schema.partyMembers).where(eq(schema.partyMembers.userId, u.id));
      await db.delete(schema.apiKeys).where(eq(schema.apiKeys.userId, u.id));
      await db.delete(schema.chatMessages).where(eq(schema.chatMessages.userId, u.id));

      // Anonymize the user row. We DON'T hard-delete because audit_log /
      // tips / orders reference user.id - losing FK integrity is worse than
      // keeping a tombstone row.
      const anonymizedEmail = `deleted-${u.id}@deleted.local`;
      await db
        .update(schema.user)
        .set({
          email: anonymizedEmail,
          name: "Deleted user",
          handle: null,
          image: null,
          role: "guest",
          emailVerified: false,
        })
        .where(eq(schema.user.id, u.id));

      purgedIds.push(u.id);
    } catch (err) {
      console.error(`gdpr-purge failed for user ${u.id}`, err);
    }
  }

  if (purgedIds.length > 0) {
    await writeAudit({
      actorId: null,
      action: "gdpr.purge",
      targetType: "system",
      targetId: "cron",
      meta: { purgedCount: purgedIds.length, userIds: purgedIds },
    });
  }

  return NextResponse.json({ ok: true, purged: purgedIds.length });
}
