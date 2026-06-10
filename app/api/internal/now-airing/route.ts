import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { emit } from "@/lib/sse/bus";
import { writeAudit } from "@/lib/api/audit";

/**
 * Playout -> backend bridge ("now airing").
 *
 * The office linear channel pushes ONE continuous stream (driven by the
 * ffplayout playout engine, or OBS for live events) into a single `streams`
 * row. ffplayout's `task` hook calls THIS endpoint on every program change so
 * the app can show what is REALLY on air, not just what was scheduled.
 *
 * Auth:  Authorization: Bearer ${PLAYOUT_SECRET}
 *
 * Body (JSON):
 *   {
 *     "streamId":    "stream_xxx",            // REQUIRED — the linear channel row
 *     "live":        true,                     // default true; false = idle/down
 *     "title":       "One Piece",             // current program title
 *     "subtitle":    "S1E1 — Romance Dawn",
 *     "targetId":    "ep_abc",                // EpgRow id, for app deep-link (opt)
 *     "thumbnailUrl":"https://...",           // optional
 *     "startedAt":   "2026-06-10T20:00:00Z",  // optional, default now
 *     "durationMin": 23                        // optional, informational only
 *   }
 *
 * On `live: true`  -> isLive=true, now-airing fields set, SSE + audit emitted.
 * On `live: false` -> isLive=false, now-airing cleared (channel offline).
 *
 * Mirrors the auth + audit shape of /api/cron/reminders and the SSE emissions
 * of /api/rtmp/on-publish, so callers and dashboards behave consistently.
 */

type Body = {
  streamId?: unknown;
  live?: unknown;
  title?: unknown;
  subtitle?: unknown;
  targetId?: unknown;
  thumbnailUrl?: unknown;
  startedAt?: unknown;
  durationMin?: unknown;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.PLAYOUT_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const streamId = asString(body.streamId);
  if (!streamId) {
    return new NextResponse("Missing streamId", { status: 400 });
  }

  const existing = (
    await db
      .select({ id: schema.streams.id, startedAt: schema.streams.startedAt })
      .from(schema.streams)
      .where(eq(schema.streams.id, streamId))
      .limit(1)
  )[0];
  if (!existing) {
    return new NextResponse("Unknown streamId", { status: 404 });
  }

  const live = body.live === undefined ? true : body.live === true;
  const nowIso = new Date().toISOString();

  // --- Channel idle / playout down: mark offline, clear now-airing. ---
  if (!live) {
    await db
      .update(schema.streams)
      .set({
        isLive: false,
        endedAt: nowIso,
        nowAiringTitle: null,
        nowAiringSubtitle: null,
        nowAiringTargetId: null,
        nowAiringThumbnailUrl: null,
        nowAiringStartedAt: null,
      })
      .where(eq(schema.streams.id, streamId));

    emit(`stream:${streamId}:status`, { isLive: false, endedAt: nowIso });
    emit(`stream:${streamId}:now-airing`, { live: false });

    void writeAudit({
      actorId: null,
      action: "playout.now_airing.offline",
      targetType: "stream",
      targetId: streamId,
      meta: {},
    });

    return NextResponse.json({ ok: true, streamId, live: false });
  }

  // --- A program is now airing on the linear channel. ---
  const title = asString(body.title);
  const subtitle = asString(body.subtitle);
  const targetId = asString(body.targetId);
  const thumbnailUrl = asString(body.thumbnailUrl);
  const programStartedAt = asString(body.startedAt) ?? nowIso;
  // First time the channel goes live, stamp startedAt; keep it across programs.
  const channelStartedAt = existing.startedAt ?? programStartedAt;

  await db
    .update(schema.streams)
    .set({
      isLive: true,
      startedAt: channelStartedAt,
      endedAt: null,
      nowAiringTitle: title,
      nowAiringSubtitle: subtitle,
      nowAiringTargetId: targetId,
      nowAiringThumbnailUrl: thumbnailUrl,
      nowAiringStartedAt: programStartedAt,
    })
    .where(eq(schema.streams.id, streamId));

  emit(`stream:${streamId}:status`, { isLive: true, startedAt: channelStartedAt });
  emit(`stream:${streamId}:now-airing`, {
    live: true,
    title,
    subtitle,
    targetId,
    thumbnailUrl,
    startedAt: programStartedAt,
  });
  emit("stream:live-now", { streamId, channelId: null });

  void writeAudit({
    actorId: null,
    action: "playout.now_airing.update",
    targetType: "stream",
    targetId: streamId,
    meta: { title, targetId, startedAt: programStartedAt },
  });

  return NextResponse.json({
    ok: true,
    streamId,
    live: true,
    nowAiring: { title, subtitle, targetId, startedAt: programStartedAt },
  });
}
