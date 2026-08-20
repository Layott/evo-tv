import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { hasMinRole } from "@/lib/auth/roles";
import { getEntitlements, NO_ENTITLEMENTS } from "@/lib/api/entitlements";
import { playbackUrlFor } from "@/lib/video/playback-url";
import { liveViewerCounts } from "@/lib/api/streams";
import { listScheduleForDay, type EpgRow } from "@/lib/api/schedule";
import { zonedDateKey } from "@/lib/epg/grid";

/**
 * GET /api/channel/main
 *
 * The flagship channel and what is on it. One request, because this drives the
 * fixed hero at the top of the site and splitting it would make the hero pop in
 * piece by piece on every page load.
 *
 * Public: the channel is the first thing a signed-out visitor sees.
 *
 * Returns the channel even when it is off air. That is deliberate. A hero that
 * disappears between broadcasts leaves a hole where the identity of the site
 * should be, and the schedule is exactly what a visitor needs at that moment:
 * not "nothing here", but "back at 20:00".
 */
export const dynamic = "force-dynamic";

export interface MainChannelResponse {
  channel: {
    id: string;
    title: string;
    tagline: string;
    posterUrl: string;
    thumbnailUrl: string;
    isLive: boolean;
    hlsUrl: string;
    requiresAuth?: true;
    /** Staff only. Absent for everyone else, see lib/api/counts.ts. */
    viewerCount?: number;
    startedAt: string | null;
  } | null;
  /** The programme on air right now, from the guide. */
  onNow: EpgRow | null;
  /** What follows it, up to three entries. */
  upNext: EpgRow[];
}

export async function GET() {
  const row = (
    await db
      .select({
        id: schema.streams.id,
        title: schema.streams.title,
        tagline: schema.streams.tagline,
        posterUrl: schema.streams.posterUrl,
        thumbnailUrl: schema.streams.thumbnailUrl,
        isLive: schema.streams.isLive,
        hlsPath: schema.streams.hlsPath,
        viewerCount: schema.streams.viewerCount,
        startedAt: schema.streams.startedAt,
      })
      .from(schema.streams)
      .where(
        and(
          eq(schema.streams.isMainChannel, true),
          isNull(schema.streams.deletedAt),
        ),
      )
      .limit(1)
  )[0];

  // Today in the channel's own clock, not the caller's, so a viewer abroad sees
  // the schedule the channel is actually running.
  const today = zonedDateKey(new Date());
  const rows = await listScheduleForDay({ date: today }).catch(
    () => [] as EpgRow[],
  );

  const nowIso = new Date().toISOString();
  const onNow =
    rows.find((r) => {
      const end = new Date(
        new Date(r.airsAt).getTime() + r.durationMin * 60_000,
      ).toISOString();
      return r.airsAt <= nowIso && nowIso < end;
    }) ?? null;

  const upNext = rows.filter((r) => r.airsAt > nowIso).slice(0, 3);

  if (!row) {
    // No flagship designated yet. The schedule is still useful, and returning
    // it means the hero can show the guide rather than an error.
    return NextResponse.json({ channel: null, onNow, upNext });
  }

  // Live counts are derived from heartbeats at read time; the column on the row
  // is only meaningful for a stream that ended.
  const counts = row.isLive ? await liveViewerCounts([row.id]) : new Map();

  // Same gate as every other stream endpoint: watching needs an account, so a
  // signed-out caller gets everything except the manifest.
  const user = await getCurrentUser();
  const signedIn = Boolean(user);
  // The ladder is a cost decision, so the flagship goes through the same gate
  // as every other stream: free viewers get 360p and 480p, 720p and 1080p are
  // for people who pay.
  const entitlements = user
    ? await getEntitlements(user.id, user.role).catch(() => NO_ENTITLEMENTS)
    : NO_ENTITLEMENTS;
  // Audience size is staff only, same rule as every other public endpoint.
  const admin = hasMinRole((user as { role?: string } | null)?.role, "admin");

  return NextResponse.json({
    channel: {
      id: row.id,
      title: row.title,
      tagline: row.tagline,
      posterUrl: row.posterUrl,
      thumbnailUrl: row.thumbnailUrl,
      isLive: row.isLive,
      hlsUrl: signedIn ? playbackUrlFor(row.id, row.hlsPath, entitlements.hdPlayback) : "",
      requiresAuth: signedIn ? undefined : (true as const),
      viewerCount: admin ? (counts.get(row.id) ?? 0) : undefined,
      startedAt: row.startedAt ?? null,
    },
    onNow,
    upNext,
  } satisfies MainChannelResponse);
}
