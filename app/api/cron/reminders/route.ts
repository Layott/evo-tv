import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull, lte } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { sendExpoPushToUser } from "@/lib/api/expo-push";
import { writeAudit } from "@/lib/api/audit";

/**
 * Vercel Cron: EPG reminder fan-out.
 *
 * vercel.json: { "path": "/api/cron/reminders", "schedule": "*\/5 * * * *" }
 *
 * Every 5 minutes, find reminders where `airsAt - leadMin` has passed but
 * notifiedAt IS NULL. For each, send an Expo Push and stamp notifiedAt so
 * the next tick skips it. Hobby plan supports 5-minute cadence; lead time
 * default 15 min so most viewers get 10-15 min heads-up.
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

  let pushed = 0;
  let stamped = 0;
  for (const r of due) {
    const minutesUntil = Math.max(
      0,
      Math.round((new Date(r.airsAt).getTime() - nowMs) / 60_000),
    );
    const sent = await sendExpoPushToUser(r.userId, {
      title: minutesUntil <= 1 ? "Airing now on EVO TV" : "Coming up on EVO TV",
      body:
        minutesUntil <= 1
          ? "Tap to watch."
          : `Starting in ${minutesUntil} min - tap to open the schedule.`,
      data: {
        kind: "epg_reminder",
        targetId: r.targetId,
        airsAt: r.airsAt,
      },
    });
    if (sent > 0) pushed += sent;

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
      meta: { candidates: candidates.length, due: due.length, stamped, pushed },
    });
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    due: due.length,
    stamped,
    pushed,
  });
}
