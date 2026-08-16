import { NextResponse, type NextRequest } from "next/server";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { sendExpoPushToUser } from "@/lib/api/expo-push";
import { sendPushToUser } from "@/lib/push";
import { createNotification } from "@/lib/api/notifications";
import { writeAudit } from "@/lib/api/audit";

/**
 * EPG reminder fan-out.
 *
 * Runs on the droplet, not on Vercel: `deploy/cron.sh reminders` every 15
 * minutes. Finds reminders where `airsAt - leadMin` has passed but
 * `notifiedAt IS NULL`, tells the viewer, and stamps the row so the next tick
 * skips it. Default lead time is 15 minutes, so most viewers get a heads-up
 * rather than a notification about something already halfway through.
 *
 * All three channels, same as an announcement: the notifications row, the app,
 * the browser. It sent to the app alone until 2026-08-16, which meant a
 * reminder set on the website reached nobody, since almost nobody has the app.
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}. Same shape as the other crons.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  // We can't subtract `lead_min` from `airs_at` inside the SQL where clause
  // portably without a date function, so do a coarse window: anything with
  // airsAt within the next 24 hours that isn't yet notified. Filter in JS.
  const horizonIso = new Date(nowMs + 24 * 3600 * 1000).toISOString();
  const candidates = await db
    .select()
    .from(schema.epgReminders)
    .where(
      and(
        isNull(schema.epgReminders.notifiedAt),
        lte(schema.epgReminders.airsAt, horizonIso),
      ),
    );

  type Due = {
    userId: string;
    targetId: string;
    airsAt: string;
    leadMin: number;
  };
  const due: Due[] = [];
  for (const r of candidates) {
    const airsAtMs = new Date(r.airsAt).getTime();
    if (Number.isNaN(airsAtMs)) continue;
    const fireAtMs = airsAtMs - r.leadMin * 60_000;
    if (fireAtMs > nowMs) continue;
    if (airsAtMs < nowMs - 60 * 60_000) continue; // already aired > 1hr ago, skip stale
    due.push({
      userId: r.userId,
      targetId: r.targetId,
      airsAt: r.airsAt,
      leadMin: r.leadMin,
    });
  }

  // Somebody who turned event reminders off still has their reminder rows, and
  // deleting them on a preference change would lose the reminder itself. Read
  // the opt-in here instead: the row is stamped either way, so a viewer who
  // opts back in is not buried in reminders for programmes that already aired.
  const optedOut = new Set<string>();
  if (due.length > 0) {
    const prefRows = await db
      .select({
        userId: schema.userPrefs.userId,
        notifOptIn: schema.userPrefs.notifOptIn,
      })
      .from(schema.userPrefs)
      .where(
        inArray(
          schema.userPrefs.userId,
          Array.from(new Set(due.map((r) => r.userId))),
        ),
      );
    for (const p of prefRows) {
      if (p.notifOptIn?.eventReminder === false) optedOut.add(p.userId);
    }
  }

  let pushed = 0;
  let webPushed = 0;
  let notified = 0;
  let skipped = 0;
  let stamped = 0;
  for (const r of due) {
    const minutesUntil = Math.max(
      0,
      Math.round((new Date(r.airsAt).getTime() - nowMs) / 60_000),
    );
    const title =
      minutesUntil <= 1 ? "Airing now on EVO TV" : "Coming up on EVO TV";
    const body =
      minutesUntil <= 1
        ? "Tap to watch."
        : `Starting in ${minutesUntil} min - tap to open the schedule.`;

    if (optedOut.has(r.userId)) {
      skipped += 1;
    } else {
      // The durable row first, for the same reason announcements write one: a
      // push can fail silently, a notification in the list cannot.
      await createNotification({
        userId: r.userId,
        type: "event_starting",
        title,
        body,
        linkUrl: "/schedule",
      });
      notified += 1;

      // Both transports. This used to send to the app only, so a viewer who
      // set a reminder on the website was never told anything.
      const sent = await sendExpoPushToUser(r.userId, {
        title,
        body,
        data: {
          kind: "epg_reminder",
          targetId: r.targetId,
          airsAt: r.airsAt,
        },
      });
      if (sent > 0) pushed += sent;

      webPushed += await sendPushToUser(r.userId, {
        title,
        body,
        url: "/schedule",
      });
    }

    await db
      .update(schema.epgReminders)
      .set({ notifiedAt: nowIso })
      .where(
        and(
          eq(schema.epgReminders.userId, r.userId),
          eq(schema.epgReminders.targetId, r.targetId),
        ),
      );
    stamped += 1;
  }

  if (stamped > 0) {
    void writeAudit({
      actorId: null,
      action: "epg.reminders.fanout",
      targetType: "system",
      targetId: "cron",
      meta: {
        candidates: candidates.length,
        due: due.length,
        stamped,
        notified,
        pushed,
        webPushed,
        skipped,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    due: due.length,
    stamped,
    notified,
    pushed,
    webPushed,
    skipped,
  });
}
