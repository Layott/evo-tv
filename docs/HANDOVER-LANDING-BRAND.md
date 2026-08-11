# Handover: landing page, EPG backbone and the brand theme

Written 2026-08-11. Covers commits `3c2f45a` through `4a93b15` on `backend`
`feat/digitalocean`, plus `3ef7cbe` and `11ba905` on `EVOTV-app`
`feat/digitalocean-uploads`.

**Everything is local. Nothing is pushed, nothing is merged, nothing is
deployed.** Read "Deploying this" before changing that.

---

## 1. What exists now

### The landing page

`/` was a client component that animated a splash for 2.5 seconds then pushed to
`/home` or `/login`. It is now a **server component** at `app/page.tsx`, and the
guest-vs-authed split moved into `proxy.ts`: signed-in users are redirected to
`/home` before render, so the landing is a pure guest surface that never has to
fetch a session.

Sections, in order: hero, on-air bug plus running-order ticker, EVO Originals,
the week, what EVO TV is, footer. Components live in `components/landing/`.

`export const revalidate = 60`. Slots are hourly so a minute of staleness is
invisible, and it is far cheaper than rendering per request.

### The EPG backbone

`epg_slots` is a **repeating weekly grid**: `dayOfWeek` (1-7, ISO) plus
`startMinute` (0-1439, Africa/Lagos) plus `durationMin`. Dated rows from
`lib/api/schedule.ts` override the slots they overlap.

The alternative, materialising 168 dated rows a week behind a cron, was rejected
on purpose: when that cron dies the channel silently looks unprogrammed, and this
codebase has already shipped a cron that 500'd on every run without anyone
noticing. A base layer plus overrides cannot go blank.

| File | Does |
|---|---|
| `lib/epg/grid.ts` | Pure time maths. No DB, no `server-only`, so it unit tests against fixed clocks |
| `lib/epg/slots.ts` | The DB read, split out to avoid an import cycle |
| `lib/epg/artwork.ts` | Posters, trailers and air days, as code not rows |
| `lib/api/epg.ts` | Grid plus dated rows, merged, for the landing page |
| `scripts/epg-pdf-to-csv.py` | Regenerates the CSV from a source PDF |
| `scripts/import-epg.ts` | Loads CSVs into `epg_slots` |

**Everything works in minute-of-week**, `(dayOfWeek - 1) * 1440 + startMinute`,
a value in `[0, 10080)`. Sunday 23:00 rolling into Monday 00:00 is then plain
modular arithmetic instead of a special case, which is exactly where hand-rolled
schedule code usually breaks.

**All grid arithmetic is Africa/Lagos via `Intl`**, never a hardcoded `+1`. The
runbook already records an hour-wide bug from crons running UTC while the droplet
ran Lagos.

### The data

- `db/epg/week-1.csv`, 168 slots, a faithful transcription of
  `projectsmanagement/GAMEEVO/APRIL EPG - WEEK 1.pdf`. **Never hand-edit it.**
  Emoji in titles are preserved here and stripped at import, so the
  transcription stays lossless.
- `db/epg/originals-august.csv`, 6 slots, the EVO originals.

`import-epg.ts` takes several CSVs and later files override earlier ones on
`(day, start)` via `overlay()`, which **throws if an overlay slot has nothing to
replace**. The base grid covers all 168 hours, so a miss means the overlay's time
is wrong, not that a row is missing. Slots are replaced, never added, so the
168-hour invariant holds.

```bash
pnpm tsx scripts/import-epg.ts
# db/epg/week-1.csv -> 168 slots
# db/epg/originals-august.csv -> 6 slots
# imported 168 slots
#   esports    90h/week
#   lifestyle  63h/week
#   anime      15h/week
```

### The brand theme, both repos

Sampled from the wordmark: a blue `#42ace8` to mint `#46e3ce` gradient on the
dark teal from `evo-tv-hero.png`.

Web tokens live in `app/globals.css`. **The high-leverage move worth
understanding:** `sky-*` was used raw in **153 files**, so instead of editing 153
files the ramp itself is redefined in `@theme`. Every existing utility became
brand-coloured at once and reverting is one block. Do not "fix" this by editing
pages.

Three files carry the palette and will silently drift:

- `backend/app/globals.css`
- `EVOTV-app/tailwind.config.js`
- `EVOTV-app/lib/theme/tokens.ts`

---

## 2. Design rules, set by owner correction

These came from the owner rejecting concrete work. They are the brief.

1. **No coloured dot, chip or icon per category.** Category is the word.
2. **No decorative glyphs.** A `✦` separator was rejected on sight.
3. **No hairline borders or rings.** Separate by surface weight, spacing, type
   scale. `--border` is set almost invisible rather than removed.
4. **No tracked-out uppercase micro-label above a headline.** Uppercase survives
   only in the "On now" badge: filled block, normal tracking. Mono is reserved
   for actual numbers.
5. **The palette must be the logo's**, sampled not chosen.
6. **No implementation detail in viewer-facing copy.**

The owner wants fun entertainment-brand energy, not "techy". They asked for
animation twice. They supply real posters and trailers and expect them used
large.

**Fix the pattern, not the instance.** They flagged one eyebrow; there were 16 of
the same treatment. They flagged one dot; the idiom was everywhere.

---

## 3. Landmines

1. **`pnpm db:generate` is unusable in this repo.** Drizzle snapshots stop at
   `0010` while migrations run to `0031`, so drizzle-kit diffs against a stale
   snapshot and interactively prompts to rename or drop live tables. Every
   migration since `0011` is hand-written with a matching `_journal.json` entry.
   `0031_epg_slots.sql` follows suit. Do not regenerate.
2. **The migration chain cannot rebuild a fresh database.** `0029` alters
   `shows`, and no migration ever creates it: it is created by
   `CREATE TABLE IF NOT EXISTS` inside `app/api/admin/db/sync-migrations/route.ts`.
   Never attempt a clean-room `pnpm db:migrate`.
3. **`.env.local` still points at Neon**, the retired database. Anyone running
   `pnpm db:migrate` locally hits Neon, not DO.
4. **`node_modules` symlinks break whenever these folders move.** They pointed at
   the pre-move `GAMEEVO/EVOTV` path and every command failed. Fix with
   `CI=true pnpm install`; plain `pnpm install` aborts with
   `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. `.next` caches absolute paths
   too and must be deleted.
5. **`/schedule` does not exist.** Only `/api/schedule` does. Schedule links
   anchor `#week` on the landing page. A real page is unbuilt.
6. **`/api/schedule` windows on a UTC day** while the grid is Lagos-local, so a
   requested date returns Lagos 01:00 to 00:00. Pre-existing contract, left alone
   rather than silently changed under the native app.
7. **No em dashes or en dashes anywhere**, including code comments and commit
   messages. Global hard rule in `~/.claude/CLAUDE.md`. Use a hyphen.

---

## 4. Deploying this

Production's database **has no `epg_slots` table**. Verification ran against
Neon because Docker was down and `.env.local` points there anyway.

Deploying is user-visible on `app.evotv.co`: `/` stops being the splash redirect
and becomes the landing page. `evotv.co` still serves the old Vite site until
repointed separately.

```bash
git push origin feat/digitalocean
ssh evotv
cd /srv/evotv/api && git pull
pnpm db:migrate                  # creates epg_slots
pnpm tsx scripts/import-epg.ts   # expect 168 slots, 90/63/15
./deploy.sh
```

---

## 5. Open, needs the owner

1. **The air hour for each original is a guess.** `EVOTV AUGUST CALENDAR.xlsx` is
   a social content calendar; each sheet's first row gives a day and a band
   ("FRIDAY AFTERNOON"), never a clock time. The days are the owner's, the hours
   are mine. One-line edit each in `db/epg/originals-august.csv`.

   | Show | Calendar says | Currently |
   |---|---|---|
   | Otaku & Chillz | Friday afternoon | Fri 15:00 |
   | Take a Seat: Confessionals | Every Friday | Fri 20:00 |
   | Breakfast Show with Jeremiah | Saturday morning | Sat 09:00 |
   | Sucre's Space | Every Saturday | Sat 17:00 |
   | Elysium Wave | Saturday evening | Sat 20:00-22:00 |

   CAGE 26 is excluded by the owner. Do not schedule it.

2. **The pillar mapping** in `PILLAR_RULES` is the spec's proposal, unconfirmed.
3. **The April grid is four months old.** The owner says it is current.

## 6. Known incomplete

- **Native has no display font.** It bundles no custom font at all, so matching
  the web's Bricolage means shipping a TTF plus `expo-font` and verifying on a
  device. Native headings are still system font.
- **The native theme change was never run on a device or simulator.** Verified by
  `tsc` and inspection only.
- **Per-page composition is untouched.** The palette and typography pass covers
  all 94 web pages and every native screen, but their card-grid layouts are
  unchanged and **67 of the 94 web pages still render `lib/mock` data**.
- **HYP has no trailer**; its card shows the still only.
- **`EVOTV-app/assets/splash-black.png` is a 1x1 transparent pixel**, so the
  splash is a flat colour with no artwork. A 3000x3000 `splash.png` sits unused
  beside it.
- **Five fabricated `shows` rows** are still in the database.
