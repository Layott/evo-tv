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

  const rtmpRows = await db
    .select({
      id: schema.streams.id,
      hlsPath: schema.streams.hlsPath,
      startedAt: schema.streams.startedAt,
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

    let stale: boolean;
    try {
      const res = await fetch(row.hlsPath, {
        method: "HEAD",
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      if (res.status === 404) {
        stale = true;
      } else if (!res.ok) {
        // 5xx from our own nginx is an outage, not an ended broadcast.
        continue;
      } else {
        const lastMod = res.headers.get("last-modified");
        stale = lastMod
          ? Date.now() - new Date(lastMod).getTime() > STALE_AFTER_MS
          : false;
      }
    } catch {
      // Unreachable. Same reasoning as Cloudflare: leave it alone.
      continue;
    }

    if (!stale) continue;

    await db
      .update(schema.streams)
      .set({ isLive: false, endedAt: nowIso, viewerCount: 0 })
      .where(eq(schema.streams.id, row.id));
    emit(`stream:${row.id}:status`, { type: "ended", at: nowIso });
    emit("stream:live-now", { type: "ended", streamId: row.id });
    changed.push({ id: row.id, isLive: false, via: "rtmp-stale" });
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
