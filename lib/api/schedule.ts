import "server-only";
import { and, between, eq, gte, isNull, lte, or } from "drizzle-orm";

import { db, schema } from "@/lib/db";

export type EpgPillar = "esports" | "anime" | "lifestyle";
export type EpgKind = "live_stream" | "episode" | "match";

export interface EpgRow {
  id: string;
  kind: EpgKind;
  pillar: EpgPillar;
  title: string;
  subtitle: string;
  thumbnailUrl: string;
  airsAt: string;
  durationMin: number;
  watchUrl: string;
  state: "scheduled" | "live" | "completed";
}

export interface ScheduleQuery {
  /** YYYY-MM-DD — single day window in UTC. */
  date: string;
  pillar?: EpgPillar | "all";
}

/**
 * Combined EPG feed for a single day. Joins three sources:
 *   - episodes by premiereAt   (anime + lifestyle pillars)
 *   - streams by scheduledStartAt OR currently live (any pillar)
 *   - matches by scheduledAt   (esports)
 *
 * Ordered ascending by airsAt. Pillar filter is post-query for simplicity —
 * day windows are bounded so volume stays small.
 */
export async function listScheduleForDay(q: ScheduleQuery): Promise<EpgRow[]> {
  const dayStart = new Date(`${q.date}T00:00:00.000Z`);
  if (Number.isNaN(dayStart.getTime())) {
    throw new Error(`Invalid date: ${q.date}`);
  }
  const dayEnd = new Date(dayStart.getTime() + 86_400_000);
  const startIso = dayStart.toISOString();
  const endIso = dayEnd.toISOString();
  const pillarFilter = q.pillar && q.pillar !== "all" ? q.pillar : undefined;

  const [episodeRows, scheduledStreams, liveStreams, matchRows] =
    await Promise.all([
      db
        .select({
          id: schema.episodes.id,
          showId: schema.episodes.showId,
          seasonNumber: schema.episodes.seasonNumber,
          episodeNumber: schema.episodes.episodeNumber,
          title: schema.episodes.title,
          thumbnailUrl: schema.episodes.thumbnailUrl,
          runtimeSec: schema.episodes.runtimeSec,
          premiereAt: schema.episodes.premiereAt,
          pillar: schema.shows.pillar,
          showTitle: schema.shows.title,
          showSlug: schema.shows.slug,
        })
        .from(schema.episodes)
        .innerJoin(schema.shows, eq(schema.episodes.showId, schema.shows.id))
        .where(
          and(
            isNull(schema.episodes.deletedAt),
            isNull(schema.shows.deletedAt),
            between(schema.episodes.premiereAt, startIso, endIso),
            pillarFilter ? eq(schema.shows.pillar, pillarFilter) : undefined,
          ),
        ),
      db
        .select({
          id: schema.streams.id,
          title: schema.streams.title,
          thumbnailUrl: schema.streams.thumbnailUrl,
          streamerName: schema.streams.streamerName,
          pillar: schema.streams.pillar,
          scheduledStartAt: schema.streams.scheduledStartAt,
          scheduledDurationMin: schema.streams.scheduledDurationMin,
        })
        .from(schema.streams)
        .where(
          and(
            isNull(schema.streams.deletedAt),
            between(
              schema.streams.scheduledStartAt,
              startIso,
              endIso,
            ),
            pillarFilter ? eq(schema.streams.pillar, pillarFilter) : undefined,
          ),
        ),
      db
        .select({
          id: schema.streams.id,
          title: schema.streams.title,
          thumbnailUrl: schema.streams.thumbnailUrl,
          streamerName: schema.streams.streamerName,
          pillar: schema.streams.pillar,
          startedAt: schema.streams.startedAt,
        })
        .from(schema.streams)
        .where(
          and(
            eq(schema.streams.isLive, true),
            isNull(schema.streams.deletedAt),
            pillarFilter ? eq(schema.streams.pillar, pillarFilter) : undefined,
          ),
        ),
      pillarFilter && pillarFilter !== "esports"
        ? Promise.resolve([])
        : db
            .select({
              id: schema.matches.id,
              eventId: schema.matches.eventId,
              scheduledAt: schema.matches.scheduledAt,
              state: schema.matches.state,
              teamAId: schema.matches.teamAId,
              teamBId: schema.matches.teamBId,
              round: schema.matches.round,
              eventTitle: schema.events.title,
              eventThumbnail: schema.events.thumbnailUrl,
            })
            .from(schema.matches)
            .innerJoin(
              schema.events,
              eq(schema.matches.eventId, schema.events.id),
            )
            .where(between(schema.matches.scheduledAt, startIso, endIso)),
    ]);

  const teamMap = await buildTeamMap(matchRows.map((m) => [m.teamAId, m.teamBId]).flat());

  const epg: EpgRow[] = [];

  for (const e of episodeRows) {
    epg.push({
      id: `ep_${e.id}`,
      kind: "episode",
      pillar: e.pillar as EpgPillar,
      title: e.showTitle,
      subtitle: `S${e.seasonNumber}E${e.episodeNumber} — ${e.title}`,
      thumbnailUrl: e.thumbnailUrl,
      airsAt: e.premiereAt ?? startIso,
      durationMin: Math.max(1, Math.round(e.runtimeSec / 60)),
      watchUrl: `/show/${e.showSlug}/${e.seasonNumber}/${e.episodeNumber}`,
      state: airTimeState(e.premiereAt, e.runtimeSec),
    });
  }

  for (const s of scheduledStreams) {
    if (!s.scheduledStartAt) continue;
    epg.push({
      id: `stream_${s.id}`,
      kind: "live_stream",
      pillar: s.pillar as EpgPillar,
      title: s.title,
      subtitle: s.streamerName,
      thumbnailUrl: s.thumbnailUrl,
      airsAt: s.scheduledStartAt,
      durationMin: s.scheduledDurationMin ?? 60,
      watchUrl: `/stream/${s.id}`,
      state: airTimeState(
        s.scheduledStartAt,
        (s.scheduledDurationMin ?? 60) * 60,
      ),
    });
  }

  // Live streams without scheduled start — surface as "live now" on today's grid only.
  const todayIsToday =
    q.date === new Date().toISOString().slice(0, 10);
  if (todayIsToday) {
    for (const s of liveStreams) {
      if (epg.some((r) => r.id === `stream_${s.id}`)) continue; // already surfaced as scheduled
      epg.push({
        id: `stream_${s.id}`,
        kind: "live_stream",
        pillar: s.pillar as EpgPillar,
        title: s.title,
        subtitle: s.streamerName,
        thumbnailUrl: s.thumbnailUrl,
        airsAt: s.startedAt ?? new Date().toISOString(),
        durationMin: 60,
        watchUrl: `/stream/${s.id}`,
        state: "live",
      });
    }
  }

  for (const m of matchRows) {
    const a = m.teamAId ? teamMap.get(m.teamAId) : null;
    const b = m.teamBId ? teamMap.get(m.teamBId) : null;
    const aTag = a?.tag ?? "TBA";
    const bTag = b?.tag ?? "TBA";
    epg.push({
      id: `match_${m.id}`,
      kind: "match",
      pillar: "esports",
      title: m.eventTitle,
      subtitle: `${aTag} vs ${bTag}${m.round ? ` · ${m.round}` : ""}`,
      thumbnailUrl: m.eventThumbnail,
      airsAt: m.scheduledAt,
      durationMin: 60,
      watchUrl: `/events/${m.eventId}`,
      state: m.state as EpgRow["state"],
    });
  }

  epg.sort((a, b) => a.airsAt.localeCompare(b.airsAt));
  return epg;
}

async function buildTeamMap(
  ids: (string | null)[],
): Promise<Map<string, { tag: string; name: string }>> {
  const map = new Map<string, { tag: string; name: string }>();
  const unique = Array.from(new Set(ids.filter((x): x is string => Boolean(x))));
  if (unique.length === 0) return map;
  const rows = await db
    .select({
      id: schema.teams.id,
      tag: schema.teams.tag,
      name: schema.teams.name,
    })
    .from(schema.teams);
  for (const r of rows) {
    if (unique.includes(r.id)) map.set(r.id, { tag: r.tag, name: r.name });
  }
  return map;
}

function airTimeState(
  airsAt: string | null,
  durationSec: number,
): EpgRow["state"] {
  if (!airsAt) return "scheduled";
  const start = new Date(airsAt).getTime();
  const end = start + durationSec * 1000;
  const now = Date.now();
  if (now < start) return "scheduled";
  if (now < end) return "live";
  return "completed";
}

export async function listScheduleForWeek(
  from: string,
  pillar?: EpgPillar | "all",
): Promise<Record<string, EpgRow[]>> {
  const days: string[] = [];
  const start = new Date(`${from}T00:00:00.000Z`);
  for (let i = 0; i < 7; i++) {
    days.push(new Date(start.getTime() + i * 86_400_000).toISOString().slice(0, 10));
  }
  const results = await Promise.all(
    days.map((d) => listScheduleForDay({ date: d, pillar })),
  );
  return Object.fromEntries(days.map((d, i) => [d, results[i] ?? []]));
}
