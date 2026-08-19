import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq, gte, isNotNull, isNull, lte } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { requireCapability } from "@/lib/api/admin";

/**
 * Everything with a date on it, in one answer.
 *
 * Four things carry a time and each lived on its own screen: a broadcast with a
 * scheduled start, a video with a release date, an episode with a premiere, and
 * the weekly grid. Answering "what is happening on Thursday" meant opening four
 * pages and holding the answer in your head.
 *
 * The weekly grid is deliberately not in here. It repeats every week and would
 * bury the four things that do not, which are the ones somebody is checking a
 * date for. The schedule screen is where the grid belongs.
 */

const querySchema = z.object({
  /** Inclusive ISO bounds. Default is the month around today. */
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export interface CalendarEntry {
  id: string;
  kind: "broadcast" | "video" | "episode";
  title: string;
  /** When it happens, or lands. */
  at: string;
  /** Minutes, for the things that have a length. */
  durationMin: number | null;
  /** Where an operator goes to change it. */
  href: string;
  /** Already happened, or still to come. */
  past: boolean;
  /** Extra line: the show for an episode, the streamer for a broadcast. */
  detail: string | null;
}

export async function GET(req: NextRequest) {
  // Editorial: this is the planning view. Broadcast rows appear on it because
  // an editor planning a week needs to see what is already on air, not because
  // they can change it: every link lands on a screen with its own guard.
  const guard = await requireCapability("editorial");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const now = new Date();
  const from =
    parsed.data.from ??
    new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const to =
    parsed.data.to ??
    new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

  const [broadcasts, videos, eps] = await Promise.all([
    db
      .select({
        id: schema.streams.id,
        title: schema.streams.title,
        at: schema.streams.scheduledStartAt,
        durationMin: schema.streams.scheduledDurationMin,
        streamer: schema.streams.streamerName,
      })
      .from(schema.streams)
      .where(
        and(
          isNotNull(schema.streams.scheduledStartAt),
          isNull(schema.streams.deletedAt),
          gte(schema.streams.scheduledStartAt, from),
          lte(schema.streams.scheduledStartAt, to),
        ),
      ),
    db
      .select({
        id: schema.vods.id,
        title: schema.vods.title,
        at: schema.vods.publishAt,
        durationSec: schema.vods.durationSec,
      })
      .from(schema.vods)
      .where(
        and(
          isNotNull(schema.vods.publishAt),
          isNull(schema.vods.deletedAt),
          gte(schema.vods.publishAt, from),
          lte(schema.vods.publishAt, to),
        ),
      ),
    db
      .select({
        id: schema.episodes.id,
        title: schema.episodes.title,
        at: schema.episodes.premiereAt,
        runtimeSec: schema.episodes.runtimeSec,
        seasonNumber: schema.episodes.seasonNumber,
        episodeNumber: schema.episodes.episodeNumber,
        showTitle: schema.shows.title,
        showId: schema.shows.id,
      })
      .from(schema.episodes)
      .leftJoin(schema.shows, eq(schema.shows.id, schema.episodes.showId))
      .where(
        and(
          isNotNull(schema.episodes.premiereAt),
          isNull(schema.episodes.deletedAt),
          gte(schema.episodes.premiereAt, from),
          lte(schema.episodes.premiereAt, to),
        ),
      ),
  ]);

  const nowMs = Date.now();
  const entries: CalendarEntry[] = [
    ...broadcasts.map((b) => ({
      id: b.id,
      kind: "broadcast" as const,
      title: b.title,
      at: b.at!,
      durationMin: b.durationMin ?? null,
      href: "/admin/streams",
      past: new Date(b.at!).getTime() < nowMs,
      detail: b.streamer || null,
    })),
    ...videos.map((v) => ({
      id: v.id,
      kind: "video" as const,
      title: v.title,
      at: v.at!,
      durationMin: v.durationSec ? Math.round(v.durationSec / 60) : null,
      href: "/admin/library",
      past: new Date(v.at!).getTime() < nowMs,
      detail: null,
    })),
    ...eps.map((e) => ({
      id: e.id,
      kind: "episode" as const,
      title: e.title,
      at: e.at!,
      durationMin: e.runtimeSec ? Math.round(e.runtimeSec / 60) : null,
      href: e.showId ? `/admin/shows?show=${e.showId}` : "/admin/shows",
      past: new Date(e.at!).getTime() < nowMs,
      detail: e.showTitle
        ? `${e.showTitle} · S${e.seasonNumber} E${e.episodeNumber}`
        : `S${e.seasonNumber} E${e.episodeNumber}`,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return NextResponse.json({ entries, from, to });
}
