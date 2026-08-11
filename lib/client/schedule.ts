import { apiGet } from "./_fetch";

/**
 * The programme guide, browser side.
 *
 * `/api/schedule` merges four sources: dated episodes, scheduled streams,
 * anything currently live, and the repeating weekly grid in `epg_slots`. A
 * dated row always wins the hours it overlaps, so an operator schedules a
 * one-off by creating it and never has to edit the rotation.
 *
 * Types are re-declared rather than imported from `lib/api/schedule`, because
 * that module is `server-only` and pulling it into a client component drags in
 * a Postgres client at build time.
 */

export type EpgPillar = "esports" | "anime" | "lifestyle";
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
  /** Empty for `grid` rows: the rotation is the channel, not a page. */
  watchUrl: string;
  state: "scheduled" | "live" | "completed";
}

/** One channel-local day. `date` is YYYY-MM-DD. */
export async function listScheduleForDay(
  date: string,
  pillar: EpgPillar | "all" = "all",
): Promise<EpgRow[]> {
  const res = await apiGet<{ date: string; rows: EpgRow[] }>("/api/schedule", {
    date,
    pillar,
  });
  return res?.rows ?? [];
}

/**
 * Seven days from `from`, keyed by date.
 *
 * One request rather than seven: the endpoint runs its joins once per day but
 * over a single round trip, which matters on a phone connection.
 */
export async function listScheduleForWeek(
  from: string,
  pillar: EpgPillar | "all" = "all",
): Promise<Record<string, EpgRow[]>> {
  const res = await apiGet<{ from: string; byDay: Record<string, EpgRow[]> }>(
    "/api/schedule",
    { week: 1, from, pillar },
  );
  return res?.byDay ?? {};
}
