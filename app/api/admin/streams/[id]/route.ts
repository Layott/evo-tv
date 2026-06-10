import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import { emit } from "@/lib/sse/bus";

/**
 * DELETE /api/admin/streams/[id]
 *
 * Soft-deletes a stream. Sets deletedAt=now. Public list endpoints filter
 * deletedAt IS NULL so the stream vanishes from feeds. If still live, also
 * force-ends and broadcasts offline. Recoverable within 30 days via a future
 * restore endpoint.
 *
 * Requires `admin` or higher (vs force_end which moderator can do).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const stream = (
    await db.select().from(schema.streams).where(eq(schema.streams.id, id)).limit(1)
  )[0];
  if (!stream) return new NextResponse("Stream not found", { status: 404 });
  if (stream.deletedAt) {
    return NextResponse.json({ error: "Already deleted" }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const wasLive = stream.isLive;
  await db
    .update(schema.streams)
    .set({
      deletedAt: nowIso,
      isLive: false,
      endedAt: wasLive ? nowIso : stream.endedAt,
      viewerCount: 0,
    })
    .where(eq(schema.streams.id, id));

  if (wasLive) {
    emit(`stream:${id}:status`, { isLive: false, endedAt: nowIso, deleted: true });
    if (stream.channelId) {
      emit(`channel:${stream.channelId}:offline`, { streamId: id, deleted: true });
    }
  }

  await writeAudit({
    actorId: guard.user.id,
    action: "stream.delete",
    targetType: "stream",
    targetId: id,
    meta: {
      role: guard.role,
      streamerName: stream.streamerName,
      channelId: stream.channelId,
      wasLive,
    },
  });

  return NextResponse.json({ ok: true, streamId: id, deletedAt: nowIso });
}

/**
 * PATCH /api/admin/streams/[id]
 *
 * Updates the scheduled airtime fields used by the EPG endpoint, plus the HLS
 * playback URL (`hlsUrl`, stored as `hlsPath`). For a linear channel served by
 * an external origin (e.g. Cloudflare Stream), an admin pastes the Cloudflare
 * `.m3u8` manifest here and the app plays it directly. Schedule fields are
 * nullable — passing `null` clears them; `hlsUrl: null | ""` clears the URL.
 *
 * Body: {
 *   scheduledStartAt?: string | null;
 *   scheduledDurationMin?: number | null;
 *   hlsUrl?: string | null;
 * }
 *
 * Requires `support_admin` or higher — programming the schedule + playback URL
 * is a routine operation that doesn't need full admin.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("support_admin");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    scheduledStartAt?: string | null;
    scheduledDurationMin?: number | null;
    hlsUrl?: string | null;
    playoutFilePath?: string | null;
    maturityRating?: string;
    contentTags?: string[];
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: {
    scheduledStartAt?: string | null;
    scheduledDurationMin?: number | null;
    hlsPath?: string;
    playoutFilePath?: string | null;
    maturityRating?: string;
    contentTags?: string[];
  } = {};

  if ("scheduledStartAt" in body) {
    const v = body.scheduledStartAt;
    if (v === null) {
      update.scheduledStartAt = null;
    } else if (typeof v === "string") {
      const t = new Date(v);
      if (Number.isNaN(t.getTime())) {
        return NextResponse.json(
          { error: "scheduledStartAt must be ISO 8601" },
          { status: 400 },
        );
      }
      update.scheduledStartAt = t.toISOString();
    } else {
      return NextResponse.json(
        { error: "scheduledStartAt must be string or null" },
        { status: 400 },
      );
    }
  }

  if ("scheduledDurationMin" in body) {
    const v = body.scheduledDurationMin;
    if (v === null) {
      update.scheduledDurationMin = null;
    } else if (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 1440) {
      update.scheduledDurationMin = Math.round(v);
    } else {
      return NextResponse.json(
        { error: "scheduledDurationMin must be 1-1440 or null" },
        { status: 400 },
      );
    }
  }

  if ("hlsUrl" in body) {
    const v = body.hlsUrl;
    if (v === null) {
      update.hlsPath = "";
    } else if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length > 2048) {
        return NextResponse.json(
          { error: "hlsUrl too long (max 2048 chars)" },
          { status: 400 },
        );
      }
      // Allow an absolute http(s) URL (e.g. Cloudflare manifest) or a relative
      // origin path (e.g. /hls/<key>.m3u8). Empty string clears it.
      if (
        trimmed !== "" &&
        !/^https?:\/\//i.test(trimmed) &&
        !trimmed.startsWith("/")
      ) {
        return NextResponse.json(
          { error: "hlsUrl must be an http(s) URL or an absolute /path" },
          { status: 400 },
        );
      }
      update.hlsPath = trimmed;
    } else {
      return NextResponse.json(
        { error: "hlsUrl must be string or null" },
        { status: 400 },
      );
    }
  }

  if ("playoutFilePath" in body) {
    const v = body.playoutFilePath;
    if (v === null || v === "") {
      update.playoutFilePath = null;
    } else if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length > 2048) {
        return NextResponse.json(
          { error: "playoutFilePath too long (max 2048 chars)" },
          { status: 400 },
        );
      }
      update.playoutFilePath = trimmed;
    } else {
      return NextResponse.json(
        { error: "playoutFilePath must be string or null" },
        { status: 400 },
      );
    }
  }

  if ("maturityRating" in body) {
    const v = body.maturityRating;
    if (v === "kids" || v === "pg" || v === "teen" || v === "mature") {
      update.maturityRating = v;
    } else {
      return NextResponse.json(
        { error: "maturityRating must be one of kids|pg|teen|mature" },
        { status: 400 },
      );
    }
  }

  if ("contentTags" in body) {
    const v = body.contentTags;
    if (Array.isArray(v) && v.every((t) => typeof t === "string")) {
      update.contentTags = v;
    } else {
      return NextResponse.json(
        { error: "contentTags must be an array of strings" },
        { status: 400 },
      );
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const existing = (
    await db.select().from(schema.streams).where(eq(schema.streams.id, id)).limit(1)
  )[0];
  if (!existing) return new NextResponse("Stream not found", { status: 404 });

  await db.update(schema.streams).set(update).where(eq(schema.streams.id, id));

  await writeAudit({
    actorId: guard.user.id,
    action: "stream.schedule_update",
    targetType: "stream",
    targetId: id,
    meta: {
      role: guard.role,
      prev: {
        scheduledStartAt: existing.scheduledStartAt,
        scheduledDurationMin: existing.scheduledDurationMin,
        hlsPath: existing.hlsPath,
        playoutFilePath: existing.playoutFilePath,
      },
      next: update,
    },
  });

  return NextResponse.json({ ok: true, streamId: id, ...update });
}
