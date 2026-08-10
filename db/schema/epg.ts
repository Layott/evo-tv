import {
  pgTable,
  text,
  integer,
  boolean,
  index,
  uniqueIndex,
  timestamp,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * The repeating weekly programme grid.
 *
 * EVO TV's channel runs a rotation that repeats every week, so the grid has no
 * dates. The alternative — materialising 168 dated rows a week into `streams`
 * behind a cron — was rejected: when that cron dies the channel silently looks
 * unprogrammed, and this codebase has already shipped a cron that 500'd on
 * every run without anyone noticing.
 *
 * So the grid is the always-there base layer and dated rows (a scheduled
 * stream, a premiering episode, a match) override the slots they overlap.
 * That is how broadcast EPGs actually work, and "on now" cannot go blank.
 */
export const epgSlots = pgTable(
  "epg_slots",
  {
    id: text("id").primaryKey(),

    // ISO-8601 weekday: 1 = Monday ... 7 = Sunday. Matches both the A..G day
    // letters in the source file and Postgres `isodow`.
    dayOfWeek: integer("day_of_week").notNull(),

    // Minutes from local midnight, 0..1439, in Africa/Lagos. Stored as minutes
    // rather than a `time` so "which slot is on now" is integer comparison with
    // no date, no timezone and no DST arithmetic. Lagos has no DST; the point is
    // that this representation cannot acquire the bug later.
    startMinute: integer("start_minute").notNull(),
    durationMin: integer("duration_min").notNull(),

    title: text("title").notNull(),
    pillar: text("pillar", { enum: ["esports", "anime", "lifestyle"] })
      .notNull()
      .default("esports"),

    // 16 | 18 in the source grid. Null means unrated rather than "all ages".
    parentalRating: integer("parental_rating"),
    genreId: integer("genre_id"),
    subgenreId: integer("subgenre_id"),

    // A01..G24. Provenance only, never a key: the source reuses `A18` for two
    // different hours, which is exactly why the unique index below is on
    // (day_of_week, start_minute) instead.
    slotCode: text("slot_code"),

    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("epg_slots_day_start_idx")
      .on(t.dayOfWeek, t.startMinute)
      .where(sql`${t.isActive}`),
    index("epg_slots_day_idx").on(t.dayOfWeek, t.startMinute),
  ],
);
