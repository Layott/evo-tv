import "server-only";
import Papa from "papaparse";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Shared                                                             */
/* ------------------------------------------------------------------ */

export interface ParseError {
  row: number; // 0-based row index in data (header excluded)
  message: string;
}

export interface ParseResult<T> {
  rows: T[];
  errors: ParseError[];
}

function bufferToText(buffer: Buffer): string {
  // Strip UTF-8 BOM if present.
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return buffer.slice(3).toString("utf8");
  }
  return buffer.toString("utf8");
}

function parseCsv(buffer: Buffer): { data: Record<string, string>[]; errors: ParseError[] } {
  const text = bufferToText(buffer);
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  const errors: ParseError[] = result.errors.map((e) => ({
    row: typeof e.row === "number" ? e.row : -1,
    message: e.message,
  }));
  return { data: result.data ?? [], errors };
}

function toNum(v: unknown, fallback = 0): number {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toStringArray(v: unknown): string[] {
  if (v === undefined || v === null || v === "") return [];
  return String(v)
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/* ------------------------------------------------------------------ */
/* Events                                                             */
/* ------------------------------------------------------------------ */

export const eventCsvSchema = z.object({
  slug: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  gameId: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  status: z.enum(["scheduled", "live", "completed", "cancelled"]),
  tier: z.enum(["s", "a", "b", "c"]),
  bannerUrl: z.string(),
  thumbnailUrl: z.string(),
  description: z.string(),
  prizePoolNgn: z.number().int().nonnegative(),
  region: z.string().min(1).max(50),
  format: z.string(),
  teamIds: z.array(z.string().min(1)).default([]),
});
export type EventDraft = z.infer<typeof eventCsvSchema>;

export function parseEventsCsv(buffer: Buffer): ParseResult<EventDraft> {
  const { data, errors } = parseCsv(buffer);
  const rows: EventDraft[] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const candidate = {
      slug: r.slug ?? "",
      title: r.title ?? "",
      gameId: r.gameId ?? r.game_id ?? "",
      startsAt: r.startsAt ?? r.starts_at ?? "",
      endsAt: r.endsAt ?? r.ends_at ?? "",
      status: r.status ?? "",
      tier: r.tier ?? "",
      bannerUrl: r.bannerUrl ?? r.banner_url ?? "",
      thumbnailUrl: r.thumbnailUrl ?? r.thumbnail_url ?? "",
      description: r.description ?? "",
      prizePoolNgn: toNum(r.prizePoolNgn ?? r.prize_pool_ngn, 0),
      region: r.region ?? "",
      format: r.format ?? "",
      teamIds: toStringArray(r.teamIds ?? r.team_ids),
    };
    const parsed = eventCsvSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({
        row: i,
        message: parsed.error.issues
          .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
          .join("; "),
      });
      continue;
    }
    rows.push(parsed.data);
  }
  return { rows, errors };
}

/* ------------------------------------------------------------------ */
/* Teams                                                              */
/* ------------------------------------------------------------------ */

export const teamCsvSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  tag: z.string().min(1).max(20),
  logoUrl: z.string(),
  country: z.string().min(1).max(50),
  region: z.string().min(1).max(50),
  gameId: z.string().min(1),
  ranking: z.number().int(),
  followers: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
});
export type TeamDraft = z.infer<typeof teamCsvSchema>;

export function parseTeamsCsv(buffer: Buffer): ParseResult<TeamDraft> {
  const { data, errors } = parseCsv(buffer);
  const rows: TeamDraft[] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const candidate = {
      slug: r.slug ?? "",
      name: r.name ?? "",
      tag: r.tag ?? "",
      logoUrl: r.logoUrl ?? r.logo_url ?? "",
      country: r.country ?? "",
      region: r.region ?? "",
      gameId: r.gameId ?? r.game_id ?? "",
      ranking: toNum(r.ranking, 0),
      followers: toNum(r.followers, 0),
      wins: toNum(r.wins, 0),
      losses: toNum(r.losses, 0),
    };
    const parsed = teamCsvSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({
        row: i,
        message: parsed.error.issues
          .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
          .join("; "),
      });
      continue;
    }
    rows.push(parsed.data);
  }
  return { rows, errors };
}

/* ------------------------------------------------------------------ */
/* Players                                                            */
/* ------------------------------------------------------------------ */

export const playerCsvSchema = z.object({
  handle: z.string().min(1).max(100),
  realName: z.string().min(1).max(200),
  avatarUrl: z.string(),
  teamId: z.string().min(1).nullable().optional(),
  gameId: z.string().min(1),
  role: z.string().min(1).max(50),
  country: z.string().min(1).max(50),
  kda: z.number().nonnegative(),
  followers: z.number().int().nonnegative(),
});
export type PlayerDraft = z.infer<typeof playerCsvSchema>;

export function parsePlayersCsv(buffer: Buffer): ParseResult<PlayerDraft> {
  const { data, errors } = parseCsv(buffer);
  const rows: PlayerDraft[] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const rawTeamId = r.teamId ?? r.team_id ?? "";
    const candidate = {
      handle: r.handle ?? "",
      realName: r.realName ?? r.real_name ?? "",
      avatarUrl: r.avatarUrl ?? r.avatar_url ?? "",
      teamId: rawTeamId === "" ? null : rawTeamId,
      gameId: r.gameId ?? r.game_id ?? "",
      role: r.role ?? "",
      country: r.country ?? "",
      kda: toNum(r.kda, 0),
      followers: toNum(r.followers, 0),
    };
    const parsed = playerCsvSchema.safeParse(candidate);
    if (!parsed.success) {
      errors.push({
        row: i,
        message: parsed.error.issues
          .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
          .join("; "),
      });
      continue;
    }
    rows.push(parsed.data);
  }
  return { rows, errors };
}
