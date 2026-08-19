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
 * nullable - passing `null` clears them; `hlsUrl: null | ""` clears the URL.
 *
 * Body: {
 *   scheduledStartAt?: string | null;
 *   scheduledDurationMin?: number | null;
 *   hlsUrl?: string | null;
 *   thumbnailUrl?: string;   // http(s) URL or /path, max 1000 chars, "" clears
 *   isLive?: boolean;        // take the stream live or end it
 * }
 *
 * `isLive` exists because nothing else can set it for an externally originated
 * stream. The flag is normally flipped by the RTMP `on-publish` callback when an
 * encoder connects, but a channel served from Cloudflare Stream never calls back
 * into this app, so without this an admin could paste a manifest and still have
 * the stream never appear under "Live now". Going live stamps `startedAt`;
 * ending stamps `endedAt` and zeroes the viewer count.
 *
 * Requires `support_admin` or higher - programming the schedule + playback URL
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
    thumbnailUrl?: string;
    maturityRating?: string;
    contentTags?: string[];
    isLive?: boolean;
    pillar?: string;
    gameId?: string | null;
    isMainChannel?: boolean;
    posterUrl?: string;
    tagline?: string;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const update: {
    title?: string;
    description?: string;
    streamerName?: string;
    eventId?: string | null;
    isPremium?: boolean;
    scheduledStartAt?: string | null;
    scheduledDurationMin?: number | null;
    hlsPath?: string;
    playoutFilePath?: string | null;
    thumbnailUrl?: string;
    maturityRating?: string;
    contentTags?: string[];
    isLive?: boolean;
    startedAt?: string;
    endedAt?: string | null;
    offlineByOperator?: boolean;
    feedLostAt?: string | null;
    reconnectWindowSec?: number;
    viewerCount?: number;
    pillar?: "esports" | "anime" | "lifestyle";
    gameId?: string | null;
    isMainChannel?: boolean;
    posterUrl?: string;
    tagline?: string;
  } = {};

  /*
   * The details an operator actually gets wrong.
   *
   * Title, description, streamer, event and tier were all fixed at creation and
   * had no way back: a typo in a programme title stayed on air, and the only
   * remedy was deleting the stream and issuing a new key, which means
   * reconfiguring the encoder for a spelling mistake.
   *
   * The slug is deliberately left alone when the title changes. It is the
   * public URL, it has already been shared, and renaming a show should not turn
   * every existing link into a 404.
   */
  if ("title" in body) {
    if (typeof body.title !== "string" || body.title.trim().length < 3) {
      return NextResponse.json(
        { error: "title must be at least 3 characters" },
        { status: 400 },
      );
    }
    update.title = body.title.trim().slice(0, 200);
  }

  if ("description" in body) {
    if (typeof body.description !== "string") {
      return NextResponse.json(
        { error: "description must be a string" },
        { status: 400 },
      );
    }
    update.description = body.description.trim().slice(0, 2000);
  }

  if ("streamerName" in body) {
    if (typeof body.streamerName !== "string") {
      return NextResponse.json(
        { error: "streamerName must be a string" },
        { status: 400 },
      );
    }
    // Blank falls back rather than showing an unattributed broadcast.
    update.streamerName = body.streamerName.trim() || "EVO TV Official";
  }

  if ("eventId" in body) {
    const v = body.eventId;
    if (v !== null && typeof v !== "string") {
      return NextResponse.json(
        { error: "eventId must be a string or null" },
        { status: 400 },
      );
    }
    update.eventId = v === "" ? null : v;
  }

  if ("isPremium" in body) {
    if (typeof body.isPremium !== "boolean") {
      return NextResponse.json(
        { error: "isPremium must be a boolean" },
        { status: 400 },
      );
    }
    update.isPremium = body.isPremium;
  }

  // Pillar and game are editable, so a programme filed under the wrong one can
  // be corrected. Without these the only fix was to delete it and start again.
  if ("pillar" in body) {
    const PILLARS = ["esports", "anime", "lifestyle"] as const;
    if (!PILLARS.includes(body.pillar as (typeof PILLARS)[number])) {
      return NextResponse.json(
        { error: `pillar must be one of ${PILLARS.join(", ")}` },
        { status: 400 },
      );
    }
    update.pillar = body.pillar as (typeof PILLARS)[number];
  }

  if ("gameId" in body) {
    const v = body.gameId;
    if (v !== null && typeof v !== "string") {
      return NextResponse.json(
        { error: "gameId must be a string or null" },
        { status: 400 },
      );
    }
    // Null is meaningful: an anime or lifestyle programme has no game.
    update.gameId = v === "" ? null : v;
  }

  /*
   * The flagship channel. At most one stream may hold it, enforced by a partial
   * unique index, so promoting one has to demote the incumbent first or the
   * insert fails. Doing it here rather than asking an operator to remember is
   * the difference between a setting and a footgun.
   */
  if ("isMainChannel" in body) {
    if (typeof body.isMainChannel !== "boolean") {
      return NextResponse.json(
        { error: "isMainChannel must be a boolean" },
        { status: 400 },
      );
    }
    if (body.isMainChannel) {
      await db
        .update(schema.streams)
        .set({ isMainChannel: false })
        .where(eq(schema.streams.isMainChannel, true));
    }
    update.isMainChannel = body.isMainChannel;
  }

  if ("posterUrl" in body) {
    if (typeof body.posterUrl !== "string") {
      return NextResponse.json(
        { error: "posterUrl must be a string" },
        { status: 400 },
      );
    }
    update.posterUrl = body.posterUrl.trim();
  }

  if ("tagline" in body) {
    if (typeof body.tagline !== "string") {
      return NextResponse.json(
        { error: "tagline must be a string" },
        { status: 400 },
      );
    }
    update.tagline = body.tagline.trim().slice(0, 160);
  }

  if ("isLive" in body) {
    if (typeof body.isLive !== "boolean") {
      return NextResponse.json(
        { error: "isLive must be a boolean" },
        { status: 400 },
      );
    }
    update.isLive = body.isLive;
    if (body.isLive) {
      update.startedAt = new Date().toISOString();
      update.endedAt = null;
      // Putting a stream back on air is also a decision to let it run, so the
      // reconciler is free to manage it again.
      update.offlineByOperator = false;
      update.feedLostAt = null;
    } else {
      update.endedAt = new Date().toISOString();
      update.viewerCount = 0;
      /*
       * Somebody meant this. The reconciler revives an rtmp stream whose
       * encoder is still publishing, which is what stops a dropped connection
       * killing a channel permanently; without this flag that same rule would
       * undo an operator ending a broadcast, a minute after they ended it.
       */
      update.offlineByOperator = true;
      update.feedLostAt = null;
    }
  }

  /*
   * How long a broadcast survives losing its feed.
   *
   * Zero ends it the moment the encoder disconnects, which is what the platform
   * used to do unconditionally. Anything above that gives the encoder a window
   * to come back before viewers are told the channel is off air.
   *
   * -1 waits forever. An always-on channel that loses its uplink overnight
   * should still be the channel in the morning, and the hour cap meant somebody
   * had to notice and restart it. Nothing ends a stream on -1 except an
   * operator pressing End broadcast, which is the point.
   */
  if ("reconnectWindowSec" in body) {
    const v = Number(body.reconnectWindowSec);
    if (!Number.isFinite(v) || v < -1 || v > 3600) {
      return NextResponse.json(
        {
          error:
            "reconnectWindowSec must be -1 (wait indefinitely) or between 0 and 3600 seconds",
        },
        { status: 400 },
      );
    }
    update.reconnectWindowSec = Math.trunc(v);
  }

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

  if ("thumbnailUrl" in body) {
    const v = body.thumbnailUrl;
    if (typeof v === "string") {
      const trimmed = v.trim();
      if (trimmed.length > 1000) {
        return NextResponse.json(
          { error: "thumbnailUrl too long (max 1000 chars)" },
          { status: 400 },
        );
      }
      // Allow an absolute http(s) URL (e.g. a Vercel Blob URL from the admin
      // upload flow) or a relative origin /path. Empty string clears it.
      if (
        trimmed !== "" &&
        !/^https?:\/\//i.test(trimmed) &&
        !trimmed.startsWith("/")
      ) {
        return NextResponse.json(
          { error: "thumbnailUrl must be an http(s) URL or an absolute /path" },
          { status: 400 },
        );
      }
      update.thumbnailUrl = trimmed;
    } else {
      return NextResponse.json(
        { error: "thumbnailUrl must be a string" },
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
        thumbnailUrl: existing.thumbnailUrl,
      },
      next: update,
    },
  });

  return NextResponse.json({ ok: true, streamId: id, ...update });
}
