import "server-only";
import { and, between, eq, gte, isNull, lte, or } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { materializeDay, zonedDateKey, zonedToUtc } from "@/lib/epg/grid";
import { getGridSlots } from "@/lib/epg/slots";

export type EpgPillar = "esports" | "anime" | "lifestyle";
/**
 * `grid` is the repeating weekly rotation from `epg_slots`. It is additive:
 * clients that switch on `kind` for an icon should fall through to a default,
 * and everything else on the row (title, subtitle, airsAt, durationMin) has the
 * same shape as the other kinds. A grid row carries no `watchUrl`, because the
 * rotation is the channel rather than an individual page.
 */
export type EpgKind = "live_stream" | "episode" | "match" | "grid";

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
  /** YYYY-MM-DD - one calendar day in the channel timezone (Africa/Lagos). */
  date: string;
  pillar?: EpgPillar | "all";
}

/**
 * Combined EPG feed for a single day. Joins three sources:
 *   - episodes by premiereAt   (anime + lifestyle pillars)
 *   - streams by scheduledStartAt OR currently live (any pillar)
 *   - matches by scheduledAt   (esports)
 *
 * Ordered ascending by airsAt. Pillar filter is post-query for simplicity -
 * day windows are bounded so volume stays small.
 */
export async function listScheduleForDay(q: ScheduleQuery): Promise<EpgRow[]> {
  // The day is the channel's own day, not a UTC one.
  //
  // This built the window as `${date}T00:00:00Z` to +24h. Lagos is UTC+1, so
  // "Tuesday" actually meant Tuesday 01:00 through Wednesday 01:00 local, and
  // every day's listing opened an hour late and ended with a stray 00:00 row
  // belonging to the next day. A viewer reads a schedule in the channel's
  // clock, which is what `zonedToUtc` anchors to.
  const [y, m, d] = q.date.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`Invalid date: ${q.date}`);
  }
  const dayStart = zonedToUtc(y, m, d, 0);
  if (Number.isNaN(dayStart.getTime())) {
    throw new Error(`Invalid date: ${q.date}`);
  }
  // Stepping to the next calendar day rather than adding 24h keeps this correct
  // across a DST change, where a local day is 23 or 25 hours long.
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const dayEnd = zonedToUtc(
    next.getUTCFullYear(),
    next.getUTCMonth() + 1,
    next.getUTCDate(),
    0,
  );
  return listScheduleBetween(
    dayStart.toISOString(),
    dayEnd.toISOString(),
    q.pillar,
  );
}

/**
 * The same join over an arbitrary window.
 *
 * Extracted so a caller needing several days (the landing page week grid) pays
 * four queries once instead of four per day. `listScheduleForDay` is a thin
 * wrapper and its contract is unchanged, so `/api/schedule`, the web schedule
 * page and the native app all keep working untouched.
 */
export async function listScheduleBetween(
  startIso: string,
  endIso: string,
  pillar?: EpgPillar | "all",
): Promise<EpgRow[]> {
  const pillarFilter = pillar && pillar !== "all" ? pillar : undefined;

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
      subtitle: `S${e.seasonNumber}E${e.episodeNumber} - ${e.title}`,
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

  // Live streams without a scheduled start - surface as "live now", but only
  // when the requested window actually contains now.
  const nowIso = new Date().toISOString();
  if (nowIso >= startIso && nowIso < endIso) {
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

  // Fourth source: the repeating weekly grid, filling every hour the dated rows
  // above do not. Added last so a dated row always wins the slots it overlaps -
  // without it this endpoint returns [] until someone schedules something, which
  // is exactly what it did before `epg_slots` existed.
  const gridRows = await gridRowsBetween(startIso, endIso, pillarFilter, epg);
  epg.push(...gridRows);

  epg.sort((a, b) => a.airsAt.localeCompare(b.airsAt));
  return epg;
}

/**
 * Materialise the weekly grid across a window and drop anything a dated row
 * already covers. An unseeded environment costs one query and returns nothing,
 * leaving this endpoint's previous behaviour exactly as it was.
 */
async function gridRowsBetween(
  startIso: string,
  endIso: string,
  pillarFilter: EpgPillar | undefined,
  dated: EpgRow[],
): Promise<EpgRow[]> {
  const slots = await getGridSlots();
  if (slots.length === 0) return [];

  const now = new Date();
  const start = new Date(startIso);
  const end = new Date(endIso);

  // Walk channel-local calendar days across the window. Stepping through UTC
  // noon keeps the date unambiguous whatever the zone offset is.
  const dateKeys = new Set<string>();
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    dateKeys.add(zonedDateKey(new Date(t)));
  }
  dateKeys.add(zonedDateKey(end));

  const rows: EpgRow[] = [];
  for (const dateKey of dateKeys) {
    for (const entry of materializeDay(slots, dateKey, now)) {
      if (entry.startsAt < startIso || entry.startsAt >= endIso) continue;
      if (pillarFilter && entry.pillar !== pillarFilter) continue;
      // A dated row that overlaps this slot replaces it.
      const covered = dated.some((d) => {
        const dEnd = new Date(
          new Date(d.airsAt).getTime() + d.durationMin * 60_000,
        ).toISOString();
        return d.airsAt < entry.endsAt && entry.startsAt < dEnd;
      });
      if (covered) continue;

      rows.push({
        id: `grid_${entry.id}_${dateKey}`,
        kind: "grid",
        pillar: entry.pillar,
        title: entry.title,
        subtitle: entry.subtitle,
        thumbnailUrl: "",
        airsAt: entry.startsAt,
        durationMin: entry.durationMin,
        watchUrl: "",
        state: entry.isLive
          ? "live"
          : entry.endsAt <= now.toISOString()
            ? "completed"
            : "scheduled",
      });
    }
  }
  return rows;
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
