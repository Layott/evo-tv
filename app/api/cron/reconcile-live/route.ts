import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { and, eq, isNotNull, or } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { emit } from "@/lib/sse/bus";
import { isInputLive, isConfigured } from "@/lib/video/cloudflare";

/**
 * Reconcile `isLive` against Cloudflare. The webhook is the fast path; this is
 * the net under it.
 *
 * A webhook is a single delivery attempt at a moment we do not control. If the
 * app is redeploying when a broadcast starts, or Cloudflare's notification is
 * dropped, the stream stays wrong until somebody notices. The failure that
 * matters is the sticky one: a stream still advertised as live hours after the
 * encoder stopped.
 *
 * Only Cloudflare-backed streams are touched, because only they have an
 * authoritative answer. Self-hosted RTMP is reconciled by nginx's
 * `on-publish-done` callback, and a manual stream is the operator's to end.
 *
 * `isInputLive` returns null when Cloudflare cannot be reached, and null is
 * skipped: an API outage must never take a live broadcast off the schedule.
 *
 * Call it from cron on the droplet, every minute or two:
 *   curl -fsS -H "authorization: Bearer $CRON_SECRET" \
 *     https://api.evotv.co/api/cron/reconcile-live
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 503 });
  }
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.nextUrl.searchParams.get("token") ??
    "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const changed: Array<{ id: string; isLive: boolean; via: string }> = [];

  // ── Self-hosted RTMP ──────────────────────────────────────────────────────
  //
  // `on-publish-done` ends these, but it is a callback from a process we do not
  // control. If nginx is killed, the container is redeployed, or the network
  // between them blips at the wrong moment, it never arrives and the stream
  // stays advertised as live indefinitely. That is the failure people notice.
  //
  // A live HLS manifest is rewritten every segment, so its freshness is the
  // truth. If it 404s or has not been touched in STALE_AFTER_MS, the encoder
  // is gone.
  const STALE_AFTER_MS = 90_000;

  /**
   * Is this manifest still being written?
   *
   * nginx rewrites the playlist on every segment, so its `Last-Modified` is the
   * only authoritative answer to "is the encoder still there". Null means the
   * question could not be answered, which is never treated as an ending: an
   * outage in our own nginx must not take a live broadcast off the schedule.
   */
  async function manifestFreshness(
    url: string,
  ): Promise<{ fresh: boolean } | null> {
    try {
      const res = await fetch(url, {
        method: "HEAD",
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      if (res.status === 404) return { fresh: false };
      if (!res.ok) return null;
      const lastMod = res.headers.get("last-modified");
      if (!lastMod) return null;
      return { fresh: Date.now() - new Date(lastMod).getTime() <= STALE_AFTER_MS };
    } catch {
      return null;
    }
  }

  const rtmpRows = await db
    .select({
      id: schema.streams.id,
      hlsPath: schema.streams.hlsPath,
      startedAt: schema.streams.startedAt,
      feedLostAt: schema.streams.feedLostAt,
      reconnectWindowSec: schema.streams.reconnectWindowSec,
    })
    .from(schema.streams)
    .where(
      and(eq(schema.streams.ingestKind, "rtmp"), eq(schema.streams.isLive, true)),
    );

  for (const row of rtmpRows) {
    if (!row.hlsPath) continue;
    // A broadcast that only just started has not written a segment yet.
    if (
      row.startedAt &&
      Date.now() - new Date(row.startedAt).getTime() < STALE_AFTER_MS
    ) {
      continue;
    }

    const freshness = await manifestFreshness(row.hlsPath);
    if (!freshness) continue; // unanswerable; leave it alone
    if (freshness.fresh) {
      /*
       * Still publishing. If a disconnect had started the reconnect clock, the
       * feed evidently came back on a connection that never fired `on_publish`,
       * so clear it here rather than letting a stale timer end a healthy
       * broadcast later.
       */
      if (row.feedLostAt) {
        await db
          .update(schema.streams)
          .set({ feedLostAt: null })
          .where(eq(schema.streams.id, row.id));
        changed.push({ id: row.id, isLive: true, via: "rtmp-feed-recovered" });
      }
      continue;
    }

    /*
     * The manifest has stopped moving. That is a lost feed, not necessarily an
     * ended broadcast: the stream is only over once its reconnect window has
     * actually elapsed.
     */
    const windowSec = row.reconnectWindowSec ?? 0;
    /*
     * -1 means wait for it, however long that takes. The feed is recorded as
     * lost so an operator can see it, and the broadcast is never ended here:
     * only End broadcast does that.
     */
    if (windowSec < 0) {
      if (!row.feedLostAt) {
        await db
          .update(schema.streams)
          .set({ feedLostAt: nowIso })
          .where(eq(schema.streams.id, row.id));
        changed.push({ id: row.id, isLive: true, via: "rtmp-feed-lost" });
      }
      continue;
    }
    const windowMs = windowSec * 1000;
    if (windowMs > 0) {
      if (!row.feedLostAt) {
        // The manifest went quiet without a disconnect callback, which happens
        // if the encoder's machine dies rather than closing the connection.
        await db
          .update(schema.streams)
          .set({ feedLostAt: nowIso })
          .where(eq(schema.streams.id, row.id));
        changed.push({ id: row.id, isLive: true, via: "rtmp-feed-lost" });
        continue;
      }
      const goneFor = Date.now() - new Date(row.feedLostAt).getTime();
      if (goneFor < windowMs) continue; // still inside the window
    }

    await db
      .update(schema.streams)
      .set({
        isLive: false,
        endedAt: nowIso,
        viewerCount: 0,
        feedLostAt: null,
      })
      .where(eq(schema.streams.id, row.id));
    emit(`stream:${row.id}:status`, { type: "ended", at: nowIso });
    emit("stream:live-now", { type: "ended", streamId: row.id });
    changed.push({ id: row.id, isLive: false, via: "rtmp-stale" });
  }

  /*
   * The other direction: publishing, but marked off air.
   *
   * `on_publish` only fires when a connection is established, so once a stream
   * is wrongly marked ended there is nothing to put it back. A single spurious
   * `on_publish_done` was therefore permanent, which is exactly what happened
   * to the flagship channel: ended at 01:11, still pushing all three rungs at
   * 03:40, and off the site the whole time.
   *
   * `offlineByOperator` is respected. Somebody who pressed "End broadcast"
   * while the encoder kept running meant it, and reviving the stream a minute
   * later would make the button a lie.
   */
  const offlineRtmp = await db
    .select({
      id: schema.streams.id,
      hlsPath: schema.streams.hlsPath,
      startedAt: schema.streams.startedAt,
    })
    .from(schema.streams)
    .where(
      and(
        eq(schema.streams.ingestKind, "rtmp"),
        eq(schema.streams.isLive, false),
        eq(schema.streams.offlineByOperator, false),
      ),
    );

  for (const row of offlineRtmp) {
    if (!row.hlsPath) continue;
    const freshness = await manifestFreshness(row.hlsPath);
    if (!freshness?.fresh) continue;

    await db
      .update(schema.streams)
      .set({
        isLive: true,
        endedAt: null,
        feedLostAt: null,
        startedAt: row.startedAt ?? nowIso,
      })
      .where(eq(schema.streams.id, row.id));
    emit(`stream:${row.id}:status`, { isLive: true, startedAt: nowIso });
    emit("stream:live-now", { type: "live", streamId: row.id });
    changed.push({ id: row.id, isLive: true, via: "rtmp-still-publishing" });
  }

  // ── Cloudflare ────────────────────────────────────────────────────────────
  if (!isConfigured()) {
    return NextResponse.json({
      ok: true,
      checkedRtmp: rtmpRows.length,
      changed,
      skipped: "cloudflare not configured",
    });
  }

  const rows = await db
    .select({
      id: schema.streams.id,
      isLive: schema.streams.isLive,
      uid: schema.streams.cfLiveInputUid,
    })
    .from(schema.streams)
    .where(
      and(
        eq(schema.streams.ingestKind, "cloudflare"),
        isNotNull(schema.streams.cfLiveInputUid),
      ),
    );

  for (const row of rows) {
    if (!row.uid) continue;
    const actuallyLive = await isInputLive(row.uid);
    if (actuallyLive === null) continue; // Cloudflare unreachable, leave it be.
    if (actuallyLive === row.isLive) continue;

    await db
      .update(schema.streams)
      .set(
        actuallyLive
          ? { isLive: true, startedAt: nowIso, endedAt: null }
          : { isLive: false, endedAt: nowIso, viewerCount: 0 },
      )
      .where(eq(schema.streams.id, row.id));

    emit(`stream:${row.id}:status`, {
      type: actuallyLive ? "live" : "ended",
      at: nowIso,
    });
    emit("stream:live-now", {
      type: actuallyLive ? "live" : "ended",
      streamId: row.id,
    });
    changed.push({ id: row.id, isLive: actuallyLive, via: "cloudflare" });
  }

  return NextResponse.json({
    ok: true,
    checkedRtmp: rtmpRows.length,
    checkedCloudflare: rows.length,
    changed,
  });
}
