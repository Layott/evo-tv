/**
 * Import the repeating weekly programme grid into `epg_slots`.
 *
 *   pnpm tsx scripts/import-epg.ts [base.csv] [overlay.csv ...]
 *
 * Defaults to `db/epg/week-1.csv` then `db/epg/originals-august.csv`. Later
 * files override earlier ones slot for slot on `(day, start)`, which is how the
 * EVO originals take their places in the rotation without the April
 * transcription being edited — that file stays a faithful copy of its PDF.
 *
 * Idempotent: the grid is replaced wholesale inside one transaction, so a re-run
 * with a corrected file leaves no orphans and a failure part-way leaves the
 * channel on the previous grid rather than on half of the new one.
 *
 * CSV columns: day,start,duration_min,title,genre_id,subgenre_id,rating,slot_code
 *
 * The file is a faithful transcription of `APRIL EPG - WEEK 1.pdf` — including
 * the decorative emoji in some titles, which are stripped here rather than in
 * the CSV so the transcription stays lossless. `scripts/epg-pdf-to-csv.py`
 * regenerates it from a PDF.
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import * as schema from "../db/schema";
import { MINUTES_PER_DAY } from "../lib/epg/grid";

/* ── Pillar mapping ─────────────────────────────────────────────────────── */

/**
 * The source grid carries numeric genre ids, not pillars, so titles are mapped
 * by hand. Taken from the spec's proposed table.
 *
 * NOTE: awaiting owner sign-off. Compound titles (`M-Pro League CODM D4 \ THE
 * MOTHERLAND GAMING`) take the pillar of their first segment.
 */
const PILLAR_RULES: Array<[RegExp, "esports" | "anime" | "lifestyle"]> = [
  [/^otaku ?(and|&) ?chill/i, "anime"],
  [/^vga show/i, "anime"],
  [/^ghost of tsushima/i, "anime"],

  // EVO originals, from the August calendar.
  [/^take a seat/i, "lifestyle"],
  [/^sucre/i, "lifestyle"],
  [/^breakfast show/i, "lifestyle"],
  [/^elysium wave/i, "lifestyle"],

  [/^lifeofdemax/i, "lifestyle"],
  [/^nobonez/i, "lifestyle"],
  [/^timmyggz/i, "lifestyle"],
  [/^ogtegs/i, "lifestyle"],
  [/^wree/i, "lifestyle"],

  [/^eafc/i, "esports"],
  [/^m-?pro league/i, "esports"],
  [/^apex legends/i, "esports"],
  [/^fist of fury/i, "esports"],
  [/^the motherland gaming/i, "esports"],
  [/^need for speed/i, "esports"],
  [/^uncut and uncensored/i, "esports"],
];

function pillarFor(title: string): "esports" | "anime" | "lifestyle" {
  const first = cleanTitle(title.split("\\")[0] ?? title);
  for (const [re, pillar] of PILLAR_RULES) {
    if (re.test(first)) return pillar;
  }
  console.warn(`[import-epg] no pillar rule for ${JSON.stringify(first)}, defaulting to esports`);
  return "esports";
}

/* ── Parsing ────────────────────────────────────────────────────────────── */

/** Strip the spreadsheet's decorative leading emoji, keep the programme name. */
function cleanTitle(raw: string): string {
  return raw
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toMinutes(t: string): number {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t.trim());
  if (!m) throw new Error(`Unparseable start time: ${JSON.stringify(t)}`);
  const minute = Number(m[1]) * 60 + Number(m[2]);
  if (minute < 0 || minute >= MINUTES_PER_DAY) {
    throw new Error(`Start time out of range: ${t}`);
  }
  return minute;
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export interface ParsedSlot {
  id: string;
  dayOfWeek: number;
  startMinute: number;
  durationMin: number;
  title: string;
  pillar: "esports" | "anime" | "lifestyle";
  parentalRating: number | null;
  genreId: number | null;
  subgenreId: number | null;
  slotCode: string | null;
}

export function parseGridCsv(text: string): ParsedSlot[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) throw new Error("Empty CSV");

  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`CSV is missing the ${name} column`);
    return i;
  };
  const iDay = col("day");
  const iStart = col("start");
  const iDur = col("duration_min");
  const iTitle = col("title");
  const iGenre = col("genre_id");
  const iSub = col("subgenre_id");
  const iRating = col("rating");
  const iCode = col("slot_code");

  const num = (v: string | undefined): number | null => {
    const s = (v ?? "").trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  const slots: ParsedSlot[] = [];
  for (const line of lines.slice(1)) {
    const c = splitCsvLine(line);
    const dayOfWeek = Number(c[iDay]);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      throw new Error(`day must be 1..7, got ${JSON.stringify(c[iDay])}`);
    }
    const startMinute = toMinutes(c[iStart] ?? "");
    const durationMin = Number(c[iDur]);
    if (!Number.isInteger(durationMin) || durationMin <= 0) {
      throw new Error(`duration_min must be a positive integer, got ${c[iDur]}`);
    }
    const title = cleanTitle(c[iTitle] ?? "");
    if (!title) throw new Error(`Empty title on day ${dayOfWeek} at ${c[iStart]}`);

    slots.push({
      id: `epg_${dayOfWeek}_${String(startMinute).padStart(4, "0")}`,
      dayOfWeek,
      startMinute,
      durationMin,
      title,
      pillar: pillarFor(c[iTitle] ?? ""),
      parentalRating: num(c[iRating]),
      genreId: num(c[iGenre]),
      subgenreId: num(c[iSub]),
      slotCode: (c[iCode] ?? "").trim() || null,
    });
  }
  return slots;
}

/**
 * Reject a grid that would leave the channel with a hole or a double-booking.
 * Both are silent failures at render time: a gap makes "on now" go blank, an
 * overlap makes it non-deterministic.
 */
export function assertCoversWeek(slots: ParsedSlot[]): void {
  const problems: string[] = [];
  for (let day = 1; day <= 7; day++) {
    const ds = slots
      .filter((s) => s.dayOfWeek === day)
      .sort((a, b) => a.startMinute - b.startMinute);
    if (ds.length === 0) {
      problems.push(`day ${day}: no slots`);
      continue;
    }
    let cursor = 0;
    for (const s of ds) {
      if (s.startMinute > cursor) {
        problems.push(`day ${day}: gap ${cursor}..${s.startMinute}`);
      } else if (s.startMinute < cursor) {
        problems.push(`day ${day}: overlap at ${s.startMinute} (previous ends ${cursor})`);
      }
      cursor = s.startMinute + s.durationMin;
    }
    if (cursor !== MINUTES_PER_DAY) {
      problems.push(`day ${day}: covers ${cursor} minutes, expected ${MINUTES_PER_DAY}`);
    }
  }
  if (problems.length) {
    throw new Error(`Grid does not cover the week:\n  ${problems.join("\n  ")}`);
  }
}

/* ── Entrypoint ─────────────────────────────────────────────────────────── */

/**
 * Later files win slot for slot on `(day, start)`. An overlay slot that lands
 * where the base has nothing is an error rather than an insertion: the base grid
 * covers all 168 hours, so a miss means the overlay's time is wrong.
 */
export function overlay(base: ParsedSlot[], extra: ParsedSlot[]): ParsedSlot[] {
  const byKey = new Map(base.map((s) => [`${s.dayOfWeek}:${s.startMinute}`, s]));
  for (const s of extra) {
    const key = `${s.dayOfWeek}:${s.startMinute}`;
    if (!byKey.has(key)) {
      throw new Error(
        `Overlay slot ${JSON.stringify(s.title)} at day ${s.dayOfWeek} ${Math.floor(
          s.startMinute / 60,
        )}:00 has no slot to replace`,
      );
    }
    byKey.set(key, s);
  }
  return [...byKey.values()];
}

async function main() {
  const files =
    process.argv.length > 2
      ? process.argv.slice(2)
      : [
          path.join("db", "epg", "week-1.csv"),
          path.join("db", "epg", "originals-august.csv"),
        ];

  let slots: ParsedSlot[] = [];
  for (const [i, file] of files.entries()) {
    const parsed = parseGridCsv(readFileSync(file, "utf8"));
    slots = i === 0 ? parsed : overlay(slots, parsed);
    console.log(`[import-epg] ${file} -> ${parsed.length} slots`);
  }
  assertCoversWeek(slots);

  const DATABASE_URL =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;
  if (!DATABASE_URL) {
    console.error("[import-epg] No database URL in the environment");
    process.exit(1);
  }

  const sql = postgres(DATABASE_URL, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    await db.transaction(async (tx) => {
      await tx.delete(schema.epgSlots);
      // Chunked so a full week stays well under the parameter limit.
      for (let i = 0; i < slots.length; i += 50) {
        await tx.insert(schema.epgSlots).values(slots.slice(i, i + 50));
      }
    });

    const byPillar = slots.reduce<Record<string, number>>((acc, s) => {
      acc[s.pillar] = (acc[s.pillar] ?? 0) + s.durationMin / 60;
      return acc;
    }, {});
    console.log(`[import-epg] imported ${slots.length} slots`);
    for (const [pillar, hours] of Object.entries(byPillar).sort((a, b) => b[1] - a[1])) {
      console.log(`[import-epg]   ${pillar.padEnd(10)} ${hours}h/week`);
    }
  } finally {
    // postgres-js keeps the event loop alive; without this the script hangs
    // after succeeding.
    await sql.end({ timeout: 5 });
  }
}

// Only run when invoked directly, so the parser can be imported by tests.
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main().catch((err) => {
    console.error("[import-epg] failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
