# EVO TV: the EPG backbone and the evotv.co landing page

Written 2026-08-10.

Two pieces, specced together because the second is worthless without the first.

1. **The EPG backbone.** A repeating weekly grid that makes "what is on right now" a real, always-correct answer.
2. **The landing page.** The guest root of `evotv.co`, whose whole job is to make a first-time visitor understand what EVO TV is, using that grid as proof.

---

## Why this exists

`evotv.co` currently serves a static Vite marketing site built around a pre-launch waitlist. The product is now accessible, so that page is out of date.

The plan is to point `evotv.co` at the Next app, which already contains the entire web product: 94 pages across `(public)`, `(auth)`, `(authed)` and `(admin)`, with role gating in `proxy.ts`. `app.evotv.co` already serves it.

Two facts discovered while scoping, both of which shape everything below:

- **67 of the 94 pages render fabricated data.** They import `@/lib/mock`, which is hardcoded arrays with a `sleep()` to fake latency. Only `(admin)` is genuinely wired to the database. Pointing `evotv.co` at the app wholesale would publish invented streams, events and products on the real domain.
- **`/api/schedule` returns an empty array.** The endpoint is well built and joins three real sources, but every one of them is dated, and nothing has ever been dated into them.

So this spec deliberately does **not** make the whole app real. It makes one true thing (the channel schedule) and builds an honest landing page on it.

### Goals

- A visitor who has never heard of EVO TV understands what it is within one screen.
- Everything on the page is true. No invented catalogue, no fake counts.
- "On now" and "up next" are correct at any moment, with no upkeep and no cron that can silently stop.
- The same backbone fixes `/schedule` in the web app and the native app, which are currently just as empty.

### Non-goals

- Making the other 67 mock pages real. That is the Phase 1A swap and it is its own project.
- Moving `evotv.co` off the Vite site. That happens after this lands, in a separate step, at which point `app.evotv.co` becomes a 301 to it.
- Per-show artwork. None exists. The page is typographic by necessity and by choice.
- CAGE 26. Explicitly excluded by the owner.

---

## Piece 1: the EPG backbone

### The source

`projectsmanagement/GAMEEVO/APRIL EPG - WEEK 1.pdf` is a complete weekly grid: **168 slots, 24 hourly slots across all 7 days**, parsed at 100%. Columns are start, end, duration, title, genre id, subgenre id, parental rating, and a slot code (`A01` to `G24`, where the letter is the day and the number is the hour).

25 distinct titles. Top of the rotation by hours per week:

```
 22h  EAFC
 20h  NoBoneZ: Clutch Mode Activated
 18h  Timmyggz: Elite Plays Live
 12h  FIST OF FURY 25 \ VGA SHOW
  8h  LifeofDemax
  8h  OgTegs: OG Vibes & Victory Runs
  8h  Ghost of Tsushima
```

The owner confirms this grid **repeats weekly, roughly**, with occasional swaps.

### The model mismatch, and the decision

`lib/api/schedule.ts` composes the EPG from three sources, all of them dated:

```
episodes  by premiereAt        anime + lifestyle
streams   by scheduledStartAt  any pillar
matches   by scheduledAt       esports
```

A repeating grid has no dates. Two ways to bridge, and the choice matters:

**Rejected: materialise the grid into dated rows.** Generate 168 rows a week, several weeks ahead, into the existing tables, with a cron rolling it forward. Reuses `/api/schedule`, `/admin/schedule` and the app's schedule screen unchanged. Rejected because when that cron fails the channel silently appears to have no programming, and a silent failure is exactly the class of bug this codebase has already produced repeatedly: a cron that 500s on every run, a bus that drops messages with no error, a connection string that quietly wins over another.

**Chosen: a repeating grid as the base layer, with dated rows overriding it.** This is how broadcast EPGs actually work. The grid is the always-there rotation; a scheduled stream, episode or match replaces the slots it overlaps. Nothing to regenerate, nothing to expire, and "on now" cannot go blank.

### Schema: `db/schema/epg.ts`

```ts
export const epgSlots = pgTable("epg_slots", {
  id: text("id").primaryKey(),

  // ISO-8601 weekday: 1 = Monday ... 7 = Sunday. Matches the A..G day letters
  // in the source file, and matches Postgres `isodow`.
  dayOfWeek: integer("day_of_week").notNull(),

  // Minutes from local midnight, 0..1439, in Africa/Lagos. Stored as minutes
  // rather than a time so that "which slot is on now" is integer comparison
  // with no date, no timezone and no DST arithmetic. Lagos has no DST, but the
  // point is that this representation cannot acquire the bug later.
  startMinute: integer("start_minute").notNull(),
  durationMin: integer("duration_min").notNull(),

  title: text("title").notNull(),
  pillar: text("pillar").notNull(),          // esports | anime | lifestyle
  parentalRating: integer("parental_rating"), // 16 | 18 in the source
  genreId: integer("genre_id"),
  subgenreId: integer("subgenre_id"),
  slotCode: text("slot_code"),                // A01..G24, provenance

  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
```

Unique index on `(dayOfWeek, startMinute)` where `isActive`. One programme per slot.

**Migration note.** This table must be created by a real drizzle migration. The `shows` table in this codebase is created by `CREATE TABLE IF NOT EXISTS` inside an HTTP endpoint (`app/api/admin/db/sync-migrations/route.ts`), which is why `0029_content_maturity.sql` cannot run against a fresh database and why the migration chain cannot rebuild one. Do not repeat that pattern here.

### The importer: `scripts/import-epg.ts`

Reads a CSV of the grid and upserts into `epg_slots`. CSV rather than PDF: the PDF parses cleanly today with `pdfplumber`, but a PDF is not an interchange format and the next week's file will differ. The import script takes `day,start,duration_min,title,genre_id,subgenre_id,rating`, and a one-off conversion of the current PDF produces the first CSV.

Two things the importer must handle, both real defects in the source:

1. **The 23:00 slot's end time is written as `12:00:00`.** Every day. Taken literally that is a negative duration. The importer derives duration from the start of the next slot, and treats the final slot of a day as running to 24:00.
2. **Slot `A18` appears twice** (17:00 and 18:00 both carry `A18`). Slot codes are provenance only, never a key, which is why the unique index is on `(dayOfWeek, startMinute)`.

### Pillar mapping

The source has numeric genre ids, not pillars, and `EpgPillar` is already `esports | anime | lifestyle`. Proposed mapping, **to be confirmed by the owner before import**:

| Pillar | Titles |
|---|---|
| esports | EAFC, all MPRO LEAGUE and M-Pro League entries, Apex Legends, FIST OF FURY 25, THE MOTHERLAND GAMING, NEED FOR SPEED, UNCUT AND UNCENSORED |
| anime | OTAKU AND CHILLS, VGA SHOW, Ghost of Tsushima |
| lifestyle | LifeofDemax, NoBoneZ, Timmyggz, OgTegs, WREE |

Several titles are compound (`M-Pro League CODM D4 \ THE MOTHERLAND GAMING`). The pillar follows the first segment.

### Merge logic: `lib/api/epg.ts`

```
gridForDay(date)      -> slots for that ISO weekday, ordered by startMinute
scheduleForDay(date)  -> gridForDay merged with the dated rows from
                         lib/api/schedule.ts; a dated row replaces every grid
                         slot whose window it overlaps
nowPlaying()          -> the slot containing the current Africa/Lagos minute
upNext()              -> the next slot after it, rolling into tomorrow at 23:00
```

`listScheduleForDay` in `lib/api/schedule.ts` gains the grid as a fourth source rather than being replaced, so `/api/schedule`, the web `/schedule` page and the native app's schedule screen all benefit without changing their contracts.

**Timezone.** All grid arithmetic is in **Africa/Lagos**. The runbook already records that the droplet's crons shifted by an hour because Vercel Cron ran UTC and the box runs Lagos. The same mistake here would put the entire channel an hour out, which looks like the schedule is simply wrong rather than like a bug.

---

## Piece 2: the landing page

### Routing

`app/page.tsx` today is a client component that animates a splash for 2.5 seconds and then pushes to `/home` or `/login`. That is app behaviour, not website behaviour, and a visitor arriving from search should not watch a loading animation.

The guest/authed split moves into `proxy.ts`, which already routes on the `evotv_role` cookie for `AUTHED_PREFIXES`, `ADMIN_PREFIX` and `AUTH_PAGES`. Add `/`: signed in, redirect to `/home` before render. Guests fall through.

This makes `app/page.tsx` a **server component**, so the landing is real HTML in the first response. That is the entire reason the Next app was chosen over the Expo web export, and rendering the landing client-side would throw it away.

### Structure

```
Hero          Africa's home for esports, anime and lifestyle.
              [ See what's on ]   ( Sign in )

On now        ON NOW    19:00-20:00   EAFC
              UP NEXT   20:00         THE MOTHERLAND GAMING \ APEX LEGENDS

The week      Seven columns, the day's programmes, filterable by pillar

Pillars       What EVO TV is: esports, anime, lifestyle. Three short blocks.

Footer        Apps, legal, contact
```

### Copy

Headline confirmed by the owner: **"Africa's home for esports, anime and lifestyle."**

**Assumption to confirm:** the primary action is **"See what's on" pointing at `/schedule`**, not "Watch". Nothing is currently live (`streams` has one row and zero live), so a watch button leads to a bare player. When a live stream does exist, the primary action becomes "Watch live" and the on-now band links to it. Flagging this because the owner's answer pointed at the schedule rather than stating a button.

No per-show blurbs. The titles are self-describing (game names, creator names) and the week grid carries the meaning. Writing 25 descriptions would be invented copy, which is the thing this whole spec exists to avoid.

### States

- **On now**: cannot be empty once the grid is imported. That is the main argument for the grid model. If the grid is genuinely empty the band collapses rather than rendering a placeholder, so an unseeded environment looks unfinished rather than broken.
- **The week**: renders from the grid alone, so it is always complete.
- **Live override**: when a dated stream overlaps the current slot, the on-now band shows it instead and gains a live indicator.

---

## Verification

`pnpm typecheck` and `pnpm test` are the existing gates. Beyond them:

- **`nowPlaying()` against fixed clock inputs**, as unit tests: mid-slot, exactly on a boundary, the 23:00 slot, the midnight rollover from Sunday 23:00 into Monday 00:00, and a dated override overlapping a grid slot.
- **Importer round trip**: import the current CSV, assert exactly 168 active slots, 24 per weekday, no gaps and no overlaps across each day.
- **The page on desktop and on a phone viewport**, both, per the project rule. Currently blocked: the Claude-in-Chrome extension reports "not connected", so no page in this project has been visually verified yet.

---

## Open items

1. **Pillar mapping needs owner confirmation** before import.
2. **The primary action assumption** above needs confirming.
3. **The April grid may be stale.** The file is labelled April Week 1 and it is now August. The owner states it is current, but the first import is the moment to check.
4. **The five fabricated `shows` rows** are still in the database. They are not used by this spec, but they will keep appearing wherever `shows` is read until they are removed.
5. **`evotv.co` still serves the Vite site.** Moving it is a separate step after this lands.
