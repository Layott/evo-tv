# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project context

EVO TV is a standalone, mobile-first esports streaming platform built for Africa. Primary title: Free Fire. Working roster also includes CoD Mobile, PUBG Mobile, EA FC Mobile. EVO TV does **not** host tournaments itself — it covers them. There is no parent AFC / Game Evo / V-ENT ecosystem; treat any historical mention as legacy copy and replace it. This repo holds the web app.

Current state (**ACTIVE — feature expansion 2026-04-27**): Phase F + Phase 0 DONE, plus a large feature-expansion pass adding mock UI for: watch parties, predictions, pick'em, fantasy, drops/rewards, tipping, creator program, mobile-money + USSD, offline downloads, lite mode, smart-TV / Android / iOS / desktop apps, Chromecast/AirPlay, embeddable player, Discord/Telegram bots, SSO, live captions, AI commentary, multi-language commentary, forensic watermark (admin), public API access (premium-gated), match calendar, auto-clipper, esports betting partner showcase (no real money). UI pages still consume `lib/mock/` everywhere. Phase 1A (Better-Auth + real `/api/auth/*`) remains queued as next backend work. Lessons from prior corrections live in `tasks/lessons.md`.

**Build strategy (locked 2026-04-22): frontend-first, fully local.** Phase F (tasks/todo.md §4) fills every screen and every user flow against a shared mock-data layer (`lib/mock/`). Only after Phase F exits does the local backend (SQLite + Drizzle + Better-Auth + local filesystem + nginx-rtmp + Paystack test) swap in via `lib/api/` modules with identical function signatures — so UI code changes one import line per domain, not more. Do not add backend code before Phase F exit, and do not hardcode data inside components — always route through `lib/mock/` or `lib/api/`. **No cloud services: no Supabase, no MinIO, no managed DB, no external realtime.** Only Paystack test sandbox is non-local, and it has a `MockProvider` so offline dev works end-to-end.

Locked decisions (2026-04-22): Paystack-first payments (Stripe scaffolded behind flag), official-only streams in MVP (admin issues keys — no creator self-service), web-first (native mobile deferred, so API must stay stateless-JWT-friendly).

## Commands

Package manager is **pnpm** (pnpm-lock.yaml present; do not switch to npm/yarn).

```bash
pnpm install        # first-time setup
pnpm dev            # next dev -p 3060 — local at http://localhost:3060
pnpm build          # next build
pnpm start          # next start -p 3060 (after build)
pnpm lint           # eslint .
```

**Port:** dev + start are pinned to **3060** because the user runs other projects on 3000/3030.

No test runner is wired yet. When tests are added per plan, run them via `pnpm test` (vitest) and `pnpm e2e` (playwright).

## Architecture

- **Framework:** Next.js 16 App Router + React 19, TypeScript strict, path alias `@/* → ./*`.
- **UI:** shadcn/ui "new-york" style (see `components.json`) over Tailwind 4.1.9 with CSS variables (base color: neutral). Radix primitives live in `components/ui/`. Icons: lucide-react. Never hand-author primitives that shadcn covers — run `pnpm dlx shadcn@latest add <name>` instead.
- **Route groups (planned refactor):** the plan reorganizes `app/` into `(auth)`, `(public)`, `(authed)`, `(admin)` groups. Current tree is flat; preserve that only until Phase 0 migration.
- **Feature components:** organized by domain under `components/` — `home/`, `stream/`, `vod/`, `admin/`. Match this pattern when adding new features (e.g., put chat in `components/chat/`, not in `components/ui/`).
- **Global layout:** `app/layout.tsx` is currently bare — only Geist fonts + Vercel Analytics. Providers (Theme, QueryClient, Auth, Toaster) are intentionally not wired yet and belong in a single `components/providers/` tree added in Phase 0.
- **Data fetching (target):** Drizzle ORM over `better-sqlite3` at `./data/evo.db`. Server Components import from `lib/db/` directly; Client Components go through TanStack Query calling `/api/*` route handlers. Zustand handles transient client state only. During Phase F the same call sites read from `lib/mock/` — Phase 0 swap preserves every function signature.
- **Streaming (target):** RTMP ingest via self-hosted `nginx-rtmp` in Docker → HLS on local disk under `./uploads/hls/` → served via `/api/uploads/[...path]`. Playback through HLS.js in `components/stream/hls-player.tsx`. Stream keys validated by `/api/rtmp/on-publish` callback. End-of-stream triggers in-process transcode job (FFmpeg) that writes multi-bitrate HLS for `/vod/[id]`.
- **Realtime (chat, viewer count, polls):** Server-Sent Events from `/api/sse/*` route handlers backed by an in-process pub/sub in `lib/sse/`. No socket library, no external broker.
- **Auth:** Better-Auth with SQLite adapter. Sessions in `sessions` table, cookies set by `middleware.ts`. `lib/auth/guards.ts` exposes `requireUser`, `requireRole`. No third-party OAuth in Phase 1.
- **Payments:** `lib/payments/provider.ts` exposes a `PaymentProvider` interface; `PaystackProvider` is the default impl, `MockProvider` auto-approves for fully offline dev, selected via `PAYMENT_PROVIDER` env var. Never import Paystack SDKs directly in route handlers or components.
- **Storage:** Local filesystem via `LocalStorageAdapter` in `lib/storage/`. Files under `./uploads/` are served only through `/api/uploads/[...path]` which checks auth + signed tokens. Never serve `./uploads/` as a static directory.
- **Schema source of truth:** `db/schema/*.ts` (Drizzle); migrations generated into `db/migrations/` via `drizzle-kit`. Never hand-edit a migration; always regenerate from schema.

## Build config gotchas

- `next.config.mjs` has `typescript.ignoreBuildErrors: true` and `images.unoptimized: true`. These are **v0 defaults to be removed in Phase 0**. Do not rely on them; when surfacing a TS error, fix it rather than adding more suppressions.
- `app/layout.tsx` declares `_geist` / `_geistMono` with underscore prefix — they are unused on purpose (fonts loaded for side effect only). Don't "fix" the unused-var warning by deleting them; apply `className={geist.variable}` to `<html>` when wiring the theme provider.
- Vercel Analytics runs **production-only** (gated by `NODE_ENV === 'production'`) — don't remove that guard.

## Workflow

The repo root `CLAUDE.md` at `C:\Users\Sweez\Desktop\LAYO\CLAUDE\CLAUDE.md` defines the workflow rules (plan-first, self-improvement loop via `tasks/lessons.md`, verification before done, demand elegance for non-trivial changes, autonomous bug fixing). Those override any defaults. Key implications:

1. **Plan before building:** update `tasks/todo.md` with checkable items; check in with the user before implementing anything non-trivial (3+ steps or architectural).
2. **After any user correction:** append the pattern to `tasks/lessons.md` with enough context that the same mistake cannot recur.
3. **Phase review:** at the end of each phase, fill the Review section of `tasks/todo.md` with what shipped, what deferred, and the smoke-test evidence.
4. **Root cause fixes only:** no temporary patches, no mock-data hangovers once a feature has a real backend in scope for that phase.

## What belongs where

- Schema / migrations → `db/schema/*.ts` (Drizzle) + `db/migrations/*.sql`
- Seed data → `db/seed.ts` (reads `lib/mock/` fixtures, idempotent upsert into SQLite)
- Infra (docker-compose, nginx-rtmp config, local helper scripts) → `infra/`
- Background workers (transcode, email, notifications) → `workers/`
- Zod validators shared between client + server → `lib/validators/`
- Server-only helpers (auth session, signed URL minting, DB client) → `lib/db/`, `lib/auth/`, `lib/storage/` with `import 'server-only'` at top
- Route handlers → `app/api/<feature>/route.ts` — keep thin, delegate to `lib/`
- SSE endpoints → `app/api/sse/<topic>/route.ts` subscribing to `lib/sse/` topics
- Never write to `./uploads/` or `./data/` from outside `lib/storage/` or `lib/db/`

## Environment

Windows 11, bash shell (Unix syntax — forward slashes, `/dev/null` not `NUL`). Node/pnpm run from the repo root. Docker Desktop required only for nginx-rtmp + Mailhog (two containers total) once Phase 0 starts. SQLite is a single file — no DB server process.

## Native app sibling

A React Native / Expo SDK 52 twin of this app lives at **`../EVOTV-app/`** (sibling, NOT a workspace nest). It is a separate repo with its own `package.json`. Same brand, same data, same flows. Stack: Expo Router 4, NativeWind v4, expo-video, lucide-react-native, TanStack Query, Zustand. Mock data is ported 1:1 from `lib/mock/*` (with `localStorage` swapped for an AsyncStorage shim). UI primitives at `EVOTV-app/components/ui/` mirror this app's shadcn primitives by name + API. When this app ships Phase 1A bearer-token API routes, the app will swap `lib/mock` imports for `lib/api` modules with identical signatures. Do not couple the two repos with a shared package — keep the duplication intentional. See `EVOTV-app/README.md` for run instructions and `tasks/todo.md` "App Track" section for status.

---

## 🛑 HARD RULE - Every admin write is audited, with both sides (owner, 2026-08-21)

**Anything an admin can change from the dashboard writes an audit row, and that
row says what changed, from what, to what.** New screen, new button, new field,
new bulk action: the audit entry ships in the same PR as the feature. A feature
that changes data and leaves no trace is not finished.

Set after the owner opened the log and found "no fields" on almost every row: 81
of 90 audit writes recorded no before/after, so the log could say somebody
edited the channel breaks and never what they set them to.

### What a write must carry

```ts
await writeAudit({
  actorId: guard.user.id,
  actorRole: guard.role,        // optional: read at write time when omitted
  capability: "broadcast",      // optional: derived from the action when omitted
  action: "channel.breaks.update",
  targetType: "system",
  targetId: "channel-breaks",
  before: previousRow,          // REQUIRED for an update or a delete
  after: nextRow,               // REQUIRED for an update or a create
});
```

- **Create**: `before: null`, `after:` the row as created.
- **Update**: read the row before mutating and pass both. `diffFields` stores
  only what moved, so passing whole rows is correct and cheap.
- **Delete**: `before:` the row as it was, `after: null`. A deleted row keeps its
  name in `meta` so the log stays readable once the record is gone.

### Reviewing your own work

Before opening the PR, run the sweep and check your new call site is not in it:

```
pnpm audit:coverage
```

It lists every `writeAudit` that records no before/after and fails on any at
all. **It is at zero and `pnpm check` runs it**, so a write that forgets both
sides fails the build rather than being noticed months later by somebody reading
the log.

### Field labels

If the feature adds a column an operator will read in the log, add it to
`FIELD_LABELS` in `components/admin/audit-log-page.tsx` so it renders as the
words the screen uses rather than the column name.

## 🛑 HARD RULE - Every public page is described for search (owner, 2026-08-22)

**Anything a signed-out visitor can reach carries its own title, description and
canonical, says what it is in structured data, and appears in the sitemap.** New
page, new route, new public feature: it ships described, in the same PR. A page
a search engine cannot read is not finished.

Set after the site spent months with **one title across 94 pages**, no
structured data at all, and a sitemap of three fixed URLs. Nothing failed, which
is exactly why nobody noticed: a page with no description looks completely
normal to everyone who already knows the URL.

### Adding content needs nothing

**A new show, VOD, clip, event, team or product is described automatically.**
The routes already carry `generateMetadata` and JSON-LD, and `app/sitemap.ts`
reads the tables, so publishing a show puts `/show/<slug>` in the sitemap with a
`TVSeries` block on the next request. Do not add anything per row.

This rule is about **new kinds of page**. That is the case the checker guards.

### What a new public page must carry

```tsx
// A server component can do it directly.
export const metadata = pageMetadata({
  title: "Teams",                       // no brand suffix; the root template adds it
  description: "The esports teams competing in the events EVO TV covers.",
  path: "/team",                        // becomes the canonical
});
```

**A client component cannot export metadata at all.** A file with `"use client"`
at the top can never have `metadata` or `generateMetadata`, and that single fact
is why 94 pages shared one title. Give it a `layout.tsx` beside it, which is a
server component, and put the metadata and the JSON-LD there. The page itself
stays untouched, so nothing about the rendering changes.

- **An entity page** (`[id]`, `[slug]`) also renders `<JsonLd>` describing what
  it is: `TVSeries`, `TVEpisode`, `VideoObject`, `SportsEvent`, `SportsTeam`,
  `Product`. Builders are in `lib/seo/json-ld.tsx`.
- **A new kind of entity** gets its rows added to `app/sitemap.ts`.
- **Anything still saying "coming soon"** uses `comingSoonMetadata`, so a
  searcher is never sent to a dead end.
- **Anything private** goes under `(auth)`, `(authed)` or `(embed)`, which are
  noindex at the group layout, and is added to `PRIVATE_PATHS` in `robots.ts`.

### Structured data is evidence, so it must be true

- **A field we do not have is omitted, never invented.** `clean()` drops empty
  values, and `isoDate` treats the epoch as absent because `toEpisode` fills a
  missing `releasedAt` with `new Date(0)`: publishing that would tell every
  crawler these shows came out in 1970.
- **No `aggregateRating` or `review`.** There are no ratings here. Emitting them
  to win a rich result is fabricating evidence, and it is a manual action when
  Google notices.
- **Prices match the checkout**, read from the same column, and a product with
  variants emits an `AggregateOffer` range rather than the base price.
- **Marked-up FAQ answers must be visible on the page.** `/upgrade` reads its
  questions from `lib/content/upgrade-faq.ts` so the two cannot drift.

### Reviewing your own work

```
pnpm seo:coverage
```

It lists every public page a search engine cannot read properly and fails on any
at all. **It is at zero and `pnpm check` runs it**, so a page shipped without a
title fails the build rather than being found months later by an owner asking
why nothing ranks.

Exceptions are written into `SITEMAP_EXEMPT` or `JSON_LD_EXEMPT` in
`scripts/seo-coverage.mjs` **with the reason**, which is the difference between
a decision and an oversight.

### The design does not move

All of this is `<head>` tags and `application/ld+json` blocks. If a change here
moves a pixel, that is a bug. One catch worth knowing: Tailwind's `space-y-*`
compiles to `& > :not([hidden]) ~ :not([hidden])`, so an injected `<script>`
counts as a sibling and pushes a margin onto the first visible child. `JsonLd`
carries `hidden` so it cannot.

## 🛑 HARD RULE - Design: no hairline borders, no glow (owner, 2026-08-17)

Two bans. Absolute. Every project, every framework, every component. Applies to code I write AND designs I propose.

### Ban 1 - No hairline / outlined anything

Never build structure out of 1px strokes. Banned shapes:

- **outlined card** - thin line rectangle drawn around content
- **outlined pill / chip** - filter chips with a ring (`All games`, `Streams`, `Teams`, ...)
- **divider / rule** - line between rows, list items, or sections
- **dashed placeholder box** - dashed outline empty state ("No events match your filters.")
- any empty state or section that is just a thin-line rectangle with centered text

Grep-level ban (CSS, Tailwind, RN, SwiftUI, Flutter):
`border`, `border-t|b|l|r`, `border-1`, `1px solid`, `border-dashed`, `divide-x`, `divide-y`, `ring-1`, `ring-2`, `outline: 1px`, `<hr>`, `Divider`, `BorderSide`, `.border(...)`, `stroke` on container frames.

Build hierarchy with **surface + space**, not lines:

| Instead of | Use |
|---|---|
| outlined card | filled surface, bg one step off the page bg, radius 12-16px, no stroke |
| outlined chip | filled chip (muted bg). Selected = stronger fill + text color. Never a ring |
| divider line | whitespace, or a background step between sections |
| dashed empty box | centered muted text on the page bg, or a filled muted surface. No dashes |
| `<hr>` | more margin |
| table row lines | zebra fill or row padding |

Only exceptions: `:focus-visible` a11y focus ring (required, keep it), native form controls the platform draws itself, and an explicit user request for a border in that specific spot.

### Ban 2 - No glow, halos, or ambient animation

Never: glowing dots or orbs, neon halos, pulsing / breathing accents, animated gradient blobs, blurred color bloom behind elements. They always end up glowing or animating, and it looks cheap.

Grep-level ban:
`box-shadow: 0 0 <n> <color>`, `shadow-[0_0_...]`, `drop-shadow(0 0`, colored `text-shadow`, `filter: blur()` on decorative orbs, `blur-2xl` / `blur-3xl` background circles, `animate-pulse`, `animate-ping`, `@keyframes glow|pulse|breathe|shimmer`, `shadow-<color>-500/50`.

Replacements:
- live / status indicator: solid flat dot, no glow, no pulse. Or a text label plus color
- emphasis: color, weight, size, fill. Not light bloom
- shadows: neutral black elevation only (soft, downward, low opacity). Never colored, never centered bloom

### Pre-ship check

Screenshot the page (desktop + mobile). If any rectangle is drawn by a thin line, or anything glows or throbs, fix it before showing the user. Both bans outrank any design skill, template, or component library default.

---

## 🛑 HARD RULE - No vibecoded look (owner, 2026-08-17)

Source: aj.on.ai reel, "30 reasons your site looks vibecoded". If a stranger can tell an LLM generated the UI in 3 seconds, it is wrong. Redo it. Sits on top of the hairline-border + glow bans, never replaces them.

### A. Color and light - BANNED

- harsh gradients (hero washes, button gradients, big multi-hue sweeps)
- rainbow coloring (multi-hue accents with no system)
- purple + black as the default palette. Also the violet/indigo-on-dark AI look
- neon colors and neon accents
- generic pastel palette (baby blue / blush pink / mint / butter card sets)
- radial orbs, blurred color blobs, aurora backgrounds
- **blinking / pulsing neon dot** (the "live" dot with a breathing ring). Static solid dot or a text label. No pulse, no glow, no ping, ever

Use instead: one committed brand hue, neutrals doing most of the work, colors carrying meaning (live, win, loss, alert), flat fills.

### B. Layout cliches - BANNED

- 3 feature cards in a row
- bento grid
- dot-grid or graph-paper background
- 3-tier pricing table (good / better / best columns)
- fake terminal window mock
- colored left stripe / accent bar on cards and callouts
- checkmark bullet lists
- outlined cards, ring chips, divider lines, dashed empty boxes (see the hairline ban)

Use instead: layouts driven by the real content and its hierarchy. Asymmetry is allowed. Different section shapes per section.

### C. Icons and type - BANNED

- default Lucide icon set dropped in unchanged
- sparkle / star "AI" icons
- emoji used as UI (icons, bullets, status, buttons). Emoji in real user content is fine
- Inter, Geist, Space Grotesk as the default typeface

Use instead: a chosen type pairing with a real reason behind it, and an icon set that matches the product weight (or the platform's own set). If no direction is given, ask before picking.

### D. Copy - BANNED

- em dashes and en dashes (already a global hard rule)
- "it's not X, it's Y" construction, and its cousins ("not just a Z, but a W")
- fake testimonials, fake logo walls, invented stats or user counts
- filler marketing voice with no concrete claim

Use instead: real names, real numbers, real quotes. If it does not exist yet, say what the thing does in plain words.

### E. Surface and depth - BANNED

- pure white (`#fff`) page background. Also pure black (`#000`)
- drop shadows sprinkled on everything
- liquid glass / frosted glass / heavy backdrop blur panels
- one soft corner radius applied uniformly to every element

Use instead: off-white or a real dark surface, a small radius scale used with intent (small elements small radius, big surfaces bigger), elevation only where something genuinely floats.

### F. Motion - BANNED

- hover animation on everything (lift, scale, glow, translate)
- animated arrows, marching chevrons, bouncing CTAs
- sparkle / shimmer / breathing effects

Use instead: instant state changes (fill, color, weight) for hover. Motion only for real feedback: opening, closing, loading, arriving. Respect `prefers-reduced-motion`.

### G. Missing pieces that scream vibecoded - REQUIRED

- **real product demo**: real screenshots, real data, real video. Not a mock frame with placeholder text
- **loading, empty, and error states**: skeletons or a real loader, a written empty state, a real error path. Every list and page
- **Terms of Service** and **Privacy Policy** pages that exist and are linked, on anything public facing
- real content everywhere. No lorem ipsum, no `Feature One`, no placeholder avatars shipped

### Pre-ship check

Ask: could this be any AI-generated landing page from this year? If yes, it is not done. Screenshot desktop + mobile, walk the list above, fix every hit before showing the user.
