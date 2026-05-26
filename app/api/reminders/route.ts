import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gte, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";

// Hobby-plan Vercel crons are hourly minimum. The server cron at /api/cron/reminders
// fires every hour, so the server-fanout path can only honor leadMin >= 60 reliably.
// Native clients should ALSO schedule a local Expo notification on the device for
// fine-grained timing (works offline, no server round-trip).
const DEFAULT_LEAD_MIN = 60;
const MAX_LEAD_MIN = 1440;

/**
 * GET /api/reminders
 * Lists the caller's pending EPG reminders (notifiedAt IS NULL, airsAt >= now).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const nowIso = new Date().toISOString();
  const rows = await db
    .select()
    .from(schema.epgReminders)
    .where(
      and(
        eq(schema.epgReminders.userId, user.id),
        isNull(schema.epgReminders.notifiedAt),
        gte(schema.epgReminders.airsAt, nowIso),
      ),
    );

  return NextResponse.json({ reminders: rows });
}

/**
 * POST /api/reminders
 * Body: { targetId: string; airsAt: string; leadMin?: number }
 *
 * Upserts a reminder. If the row exists, refreshes airsAt + leadMin (lets
 * the EPG endpoint reschedule when a stream's airtime changes). Always
 * clears notifiedAt so the cron re-arms the push.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    targetId?: string;
    airsAt?: string;
    leadMin?: number;
  } | null;
  if (!body || typeof body.targetId !== "string" || typeof body.airsAt !== "string") {
    return NextResponse.json(
      { error: "targetId and airsAt are required" },
      { status: 400 },
    );
  }

  const airsAtDate = new Date(body.airsAt);
  if (Number.isNaN(airsAtDate.getTime())) {
    return NextResponse.json(
      { error: "airsAt must be ISO 8601" },
      { status: 400 },
    );
  }

  let leadMin = DEFAULT_LEAD_MIN;
  if (typeof body.leadMin === "number") {
    if (!Number.isFinite(body.leadMin) || body.leadMin < 1 || body.leadMin > MAX_LEAD_MIN) {
      return NextResponse.json(
        { error: `leadMin must be 1-${MAX_LEAD_MIN}` },
        { status: 400 },
      );
    }
    leadMin = Math.round(body.leadMin);
  }

  const nowIso = new Date().toISOString();
  const airsAtIso = airsAtDate.toISOString();

  await db
    .insert(schema.epgReminders)
    .values({
      userId: user.id,
      targetId: body.targetId,
      airsAt: airsAtIso,
      leadMin,
      notifiedAt: null,
      createdAt: nowIso,
    })
    .onConflictDoUpdate({
      target: [schema.epgReminders.userId, schema.epgReminders.targetId],
      set: {
        airsAt: airsAtIso,
        leadMin,
        notifiedAt: null,
      },
    });

  return NextResponse.json({
    ok: true,
    targetId: body.targetId,
    airsAt: airsAtIso,
    leadMin,
  });
}

/**
 * DELETE /api/reminders?targetId=...
 * Removes the reminder for the caller. Idempotent — silently no-ops on miss.
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const { searchParams } = new URL(req.url);
  const targetId = searchParams.get("targetId");
  if (!targetId) {
    return NextResponse.json({ error: "targetId required" }, { status: 400 });
  }

  await db
    .delete(schema.epgReminders)
    .where(
      and(
        eq(schema.epgReminders.userId, user.id),
        eq(schema.epgReminders.targetId, targetId),
      ),
    );

  return NextResponse.json({ ok: true, targetId });
}
