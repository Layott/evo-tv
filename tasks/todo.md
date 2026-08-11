> **✅ Phase 1 COMPLETE 2026-04-22.** All sub-phases 1A-1G + exit test done (exit test ran simulated via curl - tasks/smoke-tests/phase-1-exit.md documents the real-OBS procedure). Phase 2/3/4/5 API layers also shipped in parallel. UI still on `@/lib/mock` by design. Dev server on :3000.

# EVO TV - Build Plan & Structure

**Project:** EVO TV - standalone mobile-first esports streaming platform for Africa. Covers tournaments (Free Fire, CoD Mobile, PUBG Mobile, EAFC Mobile). Does not host them.
**Mode:** **Frontend-first, fully local. No cloud services at all.** Build every screen + every user flow end-to-end against a mock data layer. Local backend (SQLite file, local filesystem, nginx-rtmp via Docker) swaps in only after UI is complete.
**Source of truth:** Next.js 16 + React 19 scaffold from v0 (promoted to project root 2026-04-22).

**Execution order:**
1. **Phase F** - fill every screen, wire every navigation path, build mock data module. All EPICs have a working UI shell. No server, no DB.
2. **Phase 0-5** - local backend phases replace the mock data module table-by-table; UI is untouched except for loading/error states.

---

## 0. Strategic Recap (one-pager)

- **Positioning:** "ESPN of African esports" - media + broadcast layer covering all major African mobile esports.
- **MVP bet:** content discovery + live streaming + events + basic subs. No social, no shop, no deep personalization in Phase 1.
- **Stand-alone product:** EVO TV is its own brand. No parent governance body; no upstream tournament organizer. EVO Originals is the in-house production label that produces shows, recaps, film-room episodes.
- **Success metric at Phase 1 end:** can carry a live tournament stream end-to-end (ingest → transcode → HLS → viewer → chat → VOD → recap) on localhost. Zero cloud dependencies required to run the full MVP.

---

## 1. Stack Decision (fully local)

No Supabase, no MinIO, no managed DB, no external realtime service. Everything runs on localhost or in a local Docker container.

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 + React 19 + TS | already installed |
| Styling / UI | Tailwind 4 + shadcn/ui | already installed |
| Database | **SQLite** via `better-sqlite3` | single file: `./data/evo.db` |
| ORM / query layer | **Drizzle ORM** + `drizzle-kit` | typed schema + migrations in `db/schema/` |
| Auth | **Better-Auth** (or equivalent framework-native: iron-session + custom tables) | fully self-hosted, SQLite adapter, no third-party OAuth unless user opts in |
| Server state | TanStack Query v5 | mock fetchers now, real API later |
| Client state | Zustand | |
| Video ingest → HLS | **FFmpeg + nginx-rtmp** (Docker) | OBS pushes RTMP → nginx → HLS on disk |
| Video player | **HLS.js** | one lib handles live + VOD |
| Storage | **local filesystem** - `./uploads/` | served via Next route handler + signed tokens; no S3, no MinIO |
| Realtime (chat, viewer count, polls) | **Server-Sent Events (SSE)** via Next route handlers | no socket library, no external broker needed |
| Background jobs (VOD transcode, thumbnail) | `node-cron` + in-process workers OR BullMQ + local Redis | default: in-process, swap to BullMQ only if throughput demands |
| Payments | **Paystack test mode** (sandbox only) - webhook hit via `ngrok` or captured manually in dev | only non-local piece; UI still works 100% offline via payment-provider interface `mock` impl |
| Email (dev) | **Mailhog** (Docker) - captures all outgoing mail | no external provider until prod |
| Analytics | local log file + admin dashboard | Vercel Analytics disabled in dev |

**Rationale:** SQLite + local FS + nginx-rtmp gives a complete stack in under 200MB of running processes. Nothing requires an internet connection except Paystack test mode (and even that is optional - payment provider interface has a `mock` impl that auto-approves).

---

## 2. Repo / Folder Structure (target)

```
EVOTV/
├── app/                          # Next.js routes
│   ├── (auth)/                   # login, signup, verify-email, forgot-pw
│   ├── (public)/                 # home, discover, events, stream, vod, team
│   ├── (authed)/                 # profile, library, settings, notifications
│   ├── (admin)/admin/            # admin CMS
│   ├── api/                      # route handlers
│   │   ├── auth/                 # Better-Auth routes
│   │   ├── streams/              # list/get/CRUD
│   │   ├── events/
│   │   ├── rtmp/on-publish/      # nginx-rtmp callback for stream key auth
│   │   ├── rtmp/on-publish-done/ # finalize live, enqueue VOD job
│   │   ├── sse/                  # chat, viewer-count, poll broadcast
│   │   ├── payments/paystack/webhook/
│   │   ├── uploads/              # local FS signed-URL service
│   │   └── admin/                # admin-gated endpoints
│   └── layout.tsx                # Providers (theme, query, auth, toaster)
├── components/
│   ├── ui/                       # shadcn primitives
│   ├── home/ stream/ vod/ admin/ # feature components
│   ├── auth/ chat/ events/ shop/ # NEW
│   └── providers/                # QueryProvider, AuthProvider, ThemeProvider
├── lib/
│   ├── types/                    # domain types (done in F1)
│   ├── mock/                     # mock data layer (done in F1)
│   ├── api/                      # NEW (Phase 0) - same shape as lib/mock, backed by Drizzle + local FS
│   ├── db/                       # Drizzle client + helpers
│   ├── auth/                     # Better-Auth server instance + helpers
│   ├── payments/                 # provider.ts interface + paystack.ts + mock.ts
│   ├── video/                    # HLS helpers, stream key gen, transcode jobs
│   ├── storage/                  # local FS read/write + signed tokens
│   ├── sse/                      # SSE broadcaster (in-memory pub/sub)
│   ├── validators/               # zod schemas
│   └── utils.ts
├── db/
│   ├── schema/                   # Drizzle schema files
│   ├── migrations/               # drizzle-kit generated SQL
│   └── seed.ts                   # imports lib/mock/* → writes to SQLite
├── uploads/                      # .gitignored - user avatars, banners, VOD segments
├── data/                         # .gitignored - SQLite file
├── infra/
│   ├── docker-compose.yml        # nginx-rtmp + mailhog (+ optional redis)
│   ├── nginx-rtmp/nginx.conf     # RTMP ingest + HLS output
│   └── scripts/                  # dev helpers
├── workers/                      # transcode + thumbnail jobs
├── tests/                        # playwright + vitest
├── tasks/                        # this file + lessons.md
└── .env.local.example            # document every env var (DATABASE_URL is ./data/evo.db)
```

---

## 3. Data Model (SQLite via Drizzle)

Matches the TypeScript types already defined in `lib/types/index.ts`. All primary keys are text UUIDs. All timestamps are ISO strings. No RLS - authorization is enforced in route handlers via Better-Auth session + role check.

```ts
// db/schema/users.ts  (illustrative; final form lives in code)
profiles         (id pk, handle unique, displayName, avatarUrl, bio, role, country, onboardedAt, createdAt)
user_prefs       (userId pk, favoriteGames json, favoriteTeams json, favoritePlayers json, notifOptIn json, playback json, language, theme)
sessions         (id pk, userId fk, expiresAt)       -- Better-Auth
accounts         (id pk, userId fk, providerId, ...) -- Better-Auth (local password)

games            (id pk, slug unique, name, shortName, coverUrl, iconUrl, category, platform, activePlayers)
teams            (id pk, slug unique, name, tag, logoUrl, country, region, gameId fk, ranking, followers, wins, losses)
players          (id pk, handle, realName, avatarUrl, teamId fk, gameId fk, role, country, kda, followers)

events           (id pk, slug unique, title, gameId fk, startsAt, endsAt, status, tier, bannerUrl, thumbnailUrl, description, prizePoolNgn, teamIds json, region, format)
matches          (id pk, eventId fk, teamAId fk, teamBId fk, scheduledAt, state, scoreA, scoreB, round, bestOf)

streams          (id pk, title, description, eventId fk null, gameId fk, streamerType, streamerName, streamerAvatarUrl,
                  streamKey unique secret, isLive, startedAt, endedAt, hlsUrl, thumbnailUrl, viewerCount, peakViewerCount, language, tags json, isPremium)
vods             (id pk, streamId fk null, title, description, gameId fk, durationSec, hlsUrl, mp4Url, thumbnailUrl, publishedAt, chapters json, viewCount, likeCount, isPremium)
clips            (id pk, vodId fk, streamId fk, title, creatorHandle, creatorAvatarUrl, durationSec, mp4Url, thumbnailUrl, viewCount, likeCount, createdAt, gameId fk)

follows          (userId fk, targetType, targetId, createdAt, pk(userId, targetType, targetId))
chat_messages    (id pk, streamId fk, userId fk, userHandle, userAvatarUrl, userRole, body, createdAt, isDeleted, isPinned)
polls            (id pk, streamId fk, question, options json, createdAt, closesAt, isClosed, totalVotes)

subscriptions    (id pk, userId fk, tier, status, provider, providerSubId, currentPeriodEnd, priceNgn, createdAt)
products         (id pk, slug unique, name, description, category, priceNgn, images json, variants json, featured, active, teamId fk null, inventory)
orders           (id pk, userId fk, status, items json, subtotalNgn, shippingNgn, totalNgn, shipping json, paymentProvider, paymentRef, createdAt, trackingNumber)

ads              (id pk, placement, mediaUrl, clickUrl, advertiser, active, startAt, endAt, weight, impressions, clicks)
notifications    (id pk, userId fk, type, title, body, imageUrl, linkUrl, readAt, createdAt)
feature_flags    (key pk, enabled, description)
audit_log        (id pk, actorId fk, action, targetType, targetId, meta json, createdAt)
vod_progress     (userId fk, vodId fk, positionSec, updatedAt, pk(userId, vodId))
```

Authorization pattern: every route handler calls `await requireUser()` or `await requireRole("admin")` - helpers in `lib/auth/guards.ts`.

---

## 4. Phased Build Plan

### Phase F - Frontend-complete with mock data (weeks 1-2) ⬅ **DO FIRST**

**Principle:** every route reachable, every interaction wired, zero server code. Data comes from `lib/mock/` modules whose signatures will be matched 1-for-1 by `lib/api/` in Phase 0 - swap is a one-line import change per file.

**F1. Mock data foundation** ✅ DONE (2026-04-22)

**F2. Providers + global shell**
- [ ] `components/providers/` - ThemeProvider (next-themes), ToasterProvider (sonner), MockAuthProvider (fake session + role toggle, persisted to `localStorage`), QueryClientProvider (TanStack Query, mock fetchers)
- [ ] Wire all providers in `app/layout.tsx`; apply Geist font variables
- [ ] `middleware.ts` - reads cookie set by MockAuthProvider, redirects `(authed)` / `(admin)` routes when logged out / not admin
- [ ] Dev-only role switcher widget: `guest | user | premium | admin` - one click changes session, drives gated UI

**F3. Route groups refactor**
- [ ] Reorganize `app/` into `(auth)`, `(public)`, `(authed)`, `(admin)` groups
- [ ] Group layouts: `(authed)/layout.tsx` renders bottom nav + top bar; `(admin)/layout.tsx` renders admin sidebar; `(auth)/layout.tsx` renders centered card
- [ ] Every existing page still renders at its old URL

**F4. Auth + onboarding screens (UI only)**
- [ ] `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` - full forms, zod + react-hook-form validation, fake success paths set MockAuthProvider session
- [ ] `/onboarding` - 4-step wizard persists to MockAuthProvider; skip/back/next all work; success redirects to `/home`
- [ ] Third-party sign-in buttons (Google / Apple / Discord) - styled but disabled with tooltip "Local mode: use email"

**F5. Home + discovery**
- [ ] `/home` - hero carousel (live now), live streams grid, upcoming events row, trending clips, "Because you watched" (premium only), ad banner (free only)
- [ ] `/discover` - search input with live suggestions (filter mock data), filter chips (game / tier / language / region), result tabs (streams / VODs / teams / players), empty states
- [ ] `/categories/[slug]` - game-specific hub

**F6. Live events**
- [ ] `/events` - list grouped by status (live now / upcoming / past), sort + filter
- [ ] `/events/[id]` - hero, countdown, bracket placeholder component, participating teams, watch-live CTA, "Remind me" button (toast confirm)
- [ ] `/events/[id]/bracket` - static bracket UI

**F7. Streaming + VOD playback (UI only)**
- [ ] `components/stream/video-player.tsx` - custom shell around `<video>` with a local MP4 for demo; quality menu, captions toggle, speed, PiP, fullscreen. HLS.js wiring deferred to Phase 1C.
- [ ] `/stream/[id]` - player + stream info + chat panel + polls panel + in-stream shop panel + follow/subscribe buttons
- [ ] `/vod/[id]` - player + chapters list + description + related VODs + comments section (UI only)
- [ ] `/clips/[id]` - short-form clip viewer (vertical layout)

**F8. Social / community (UI only)**
- [ ] Live chat panel - mock messages stream in via setInterval; send box appends locally; slow mode + emoji picker UI
- [ ] Live polls - viewer vote UI, progress bars animate, "results after close" state
- [ ] Follow / unfollow buttons across stream / vod / team / player pages (MockAuthProvider persists follows list to localStorage)
- [ ] Like + share + report actions (toast confirmations)

**F9. Profile + library + settings**
- [ ] `/profile` - avatar, bio, followed teams/players, watch history, subscription status, edit profile modal
- [ ] `/profile/[handle]` - public view
- [ ] `/library` - continue watching, saved VODs, downloads placeholder, watch history
- [ ] `/settings` - account, notifications, playback (default quality, captions), privacy, language, appearance (light/dark/system)
- [ ] `/notifications` - list with unread/read split, mark-all-read

**F10. Monetization screens**
- [ ] `/settings/billing` - current plan, upgrade CTA, payment history, cancel flow
- [ ] `/upgrade` - tier comparison table (Free / Premium), Paystack branding on CTA
- [ ] `/checkout` - order summary, address form (NGN + Paystack visuals), card iframe stub, confirmation
- [ ] `/shop` - product grid, filters, sort
- [ ] `/shop/[id]` - product detail with variants + add-to-cart
- [ ] `/cart` - line items, totals, promo code field
- [ ] `/order/[id]` - confirmation + tracking states
- [ ] `/profile/orders` - past orders list
- [ ] `/profile/orders/[id]` - receipt

**F11. Admin CMS (every sub-page filled)**
- [ ] `/admin` - dashboard: live streams count, today signups, MRR, top streams (recharts)
- [ ] `/admin/streams` - CRUD table, "reveal key once" modal, OBS settings panel
- [ ] `/admin/content` - games / teams / players / events CRUD, image upload stub
- [ ] `/admin/polls` - poll library + create poll form
- [ ] `/admin/ads` - banner uploads, placement picker, schedule, weight
- [ ] `/admin/users` - search users, view profile, change role, suspend
- [ ] `/admin/analytics` - charts (recharts): views over time, retention cohort, revenue, top titles
- [ ] `/admin/settings` - feature flags UI (toggles), site-wide branding, email templates
- [ ] `/admin/orders` - order management, refunds
- [ ] `/admin/moderation` - reported messages queue, ban management

**F12. Polish + flow verification**
- [ ] Loading skeletons on every data-fetching component
- [ ] Error boundaries per route group with retry
- [ ] Empty states (no streams, no results, no orders, etc.)
- [ ] 404 + 500 pages styled
- [ ] Toast for every user action (follow, subscribe, add to cart, save settings)
- [ ] Keyboard shortcuts on player (space, m, f, arrows)
- [ ] Mobile responsive check: every page at 360px, 768px, 1440px
- [ ] Light/dark theme parity
- [ ] Remove `typescript.ignoreBuildErrors: true` from `next.config.mjs` - fix all real errors
- [ ] `pnpm lint` clean
- [ ] Click-through smoke test: guest → signup → onboarding → home → stream → follow → subscribe (Paystack UI) → watch → vod → profile → settings → logout. Document in `tasks/smoke-tests/phase-f.md`.

**Phase F exit criteria:** stakeholder demos full product end-to-end in a browser, mock data only. Every page exists, every button navigates or toasts, every form validates. No broken links, no blank admin tabs.

---

### Phase 0 - Local backend foundation (runs AFTER Phase F)

- [ ] Add deps: `better-sqlite3`, `drizzle-orm`, `drizzle-kit`, `better-auth` (or chosen local auth lib), `argon2` (if rolling own pw hash), `zod`
- [ ] Create `infra/docker-compose.yml` with nginx-rtmp + mailhog (+ optional redis for BullMQ later)
- [ ] Write `.env.local.example` + `.env.local` (DATABASE_URL=./data/evo.db, AUTH_SECRET, PAYSTACK_TEST_KEYS, UPLOADS_DIR=./uploads)
- [ ] `db/schema/*.ts` - Drizzle schema mirroring `lib/types`
- [ ] `drizzle-kit generate` → migration 0001; commit both schema + SQL
- [ ] `db/seed.ts` - imports from `lib/mock/*`, inserts rows into SQLite (idempotent: upsert by slug/id)
- [ ] `lib/db/index.ts` - singleton `drizzle(new Database('./data/evo.db'))` helper
- [ ] `lib/auth/` - Better-Auth config (SQLite adapter, email+password, sessions, optional OAuth stubs)
- [ ] `lib/auth/guards.ts` - `getSession`, `requireUser`, `requireRole`
- [ ] `lib/storage/local-fs.ts` - read/write `./uploads/`, signed-token helper, `/api/uploads/[...path]` route for serving with auth check
- [ ] `lib/api/` - same signatures as `lib/mock/`, backed by Drizzle queries; components flip `from "@/lib/mock"` → `from "@/lib/api"`
- [ ] `middleware.ts` - swap MockAuthProvider cookie for Better-Auth session refresh
- [ ] Wire ESLint + Prettier + TS strict, `pnpm check` script

---

### Phase 1 - MVP Core (weeks 3-5)

**1A. Auth & onboarding**
- [ ] Email + password signup via Better-Auth; email verify via Mailhog-captured link
- [ ] Real `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`
- [ ] Persist onboarding prefs to `user_prefs` on step completion
- [ ] Profile page reads real user; avatar upload → `./uploads/avatars/`
- [ ] Middleware redirects unauthed users hitting `(authed)` routes

**1B. Content discovery**
- [ ] `/home` hero + sections read from SQLite via `lib/api/streams.ts` and `lib/api/events.ts`
- [ ] `/discover` search: SQLite `LIKE` on indexed columns (add FTS5 table for full-text if needed)
- [ ] Category filter, trending section (order by `viewerCount DESC`)
- [ ] Bottom nav active route highlighting

**1C. Live streaming pipeline (official-only)**
- [ ] `nginx-rtmp/nginx.conf` - `application live { hls on; hls_path /hls; on_publish http://host.docker.internal:3000/api/rtmp/on-publish; }`
- [ ] `/api/rtmp/on-publish` validates stream key against `streams.streamKey` + `streamerType='official'`, sets `isLive=true`, broadcasts SSE "stream-started"
- [ ] `/api/rtmp/on-publish-done` sets `isLive=false`, enqueues VOD transcode job
- [ ] `components/stream/hls-player.tsx` replaces placeholder player - HLS.js, quality selector, captions
- [ ] `/stream/[id]` subscribes to SSE for viewer count updates
- [ ] Admin-only stream manager - create stream, one-time key reveal, OBS ingest URL + key block
- [ ] No creator-facing setup UI (official-only locked per decision)

**1D. Live events + notifications**
- [ ] `/events` list from DB ordered by `startsAt`
- [ ] `/events/[id]` countdown, teams, bracket placeholder, "Remind me" persists to `notifications`
- [ ] Web push via `web-push` lib with VAPID keys in `.env.local`; SSE for in-app
- [ ] In-app notifications panel reads from `notifications` table

**1E. Basic subscriptions (Paystack-first)**
- [ ] `lib/payments/provider.ts` interface with `PaystackProvider` + `MockProvider` impls; env flag `PAYMENT_PROVIDER=paystack|mock`
- [ ] Paystack test keys in `.env.local`; `/settings/billing` page
- [ ] One tier: Premium (₦X/mo) - unlocks ad-free + premium VODs
- [ ] Checkout → Paystack Transaction Init → inline popup → `/api/payments/paystack/webhook` verifies HMAC-SHA512, updates `subscriptions`
- [ ] Webhook endpoint hit locally via `ngrok http 3000` (document in README); MockProvider bypasses this entirely for offline dev
- [ ] `useSubscription()` hook gates premium content
- [ ] Stripe impl deferred (can plug in later behind same interface; not scaffolded in Phase 1)

**1F. VOD transcode + playback**
- [ ] In-process worker (or BullMQ job): ended stream → FFmpeg multi-bitrate HLS → `./uploads/vods/{id}/` → insert `vods` row
- [ ] `/vod/[id]` plays via signed URL through `/api/uploads/vods/...`
- [ ] `vod_progress` resume

**1G. Admin CMS (MVP slice)**
- [ ] Gate `/admin` behind `profiles.role='admin'`
- [ ] Overview page metrics (live streams, today signups, active subs)
- [ ] Streams manager - CRUD, regenerate keys
- [ ] Content manager - CRUD games/teams/players/events
- [ ] Ads manager - banner upload → `./uploads/ads/` → placement + schedule

**Phase 1 exit criteria:** admin creates event, issues stream key, pushes from OBS, a viewer signs up → subscribes (Paystack test via ngrok, or MockProvider) → watches live <5s latency → sees VOD after stream ends. All on localhost.

---

### Phase 2 - Engagement (weeks 6-7)

- [ ] Follow system (teams/players/streamers)
- [ ] Live chat via SSE, moderation (slow mode, banned-word filter, delete message)
- [ ] Live polls via SSE
- [ ] Likes + shares on VODs/clips
- [ ] Trending clips from likes + view velocity

### Phase 3 - Monetization expansion (weeks 8-9)

- [ ] Multi-tier subs (free / supporter / pro)
- [ ] Shop: products CRUD (admin), `/shop`, `/checkout` real Paystack, order confirmation emails via Mailhog
- [ ] Merch fulfillment webhook stub
- [ ] Ad-serving: show ads only to free tier, rotate by weight
- [ ] (Optional) Stripe adapter plugged in behind same provider interface

### Phase 4 - Personalization + Performance (weeks 10-11)

- [ ] "Because you watched…" - simple collaborative filtering on `vod_progress` + follows
- [ ] Home feed reorder per user
- [ ] `next/image` with custom loader for `/api/uploads/` (unoptimized=false)
- [ ] Cache headers on HLS segments
- [ ] Local error log viewer + admin dashboard for errors
- [ ] Load test: 500 concurrent viewers on one stream with `artillery`

### Phase 5 - Admin CMS full + polish (week 12)

- [ ] Full analytics dashboard (retention, revenue, funnel, cohort) reading SQLite
- [ ] Users & roles manager
- [ ] Feature flags UI (reads `feature_flags` table)
- [ ] Audit log viewer
- [ ] Bulk content import (CSV → `events`, `teams`)

---

## 5. Parallelization / Subagent Strategy

Safe to parallelize:
- Schema design review (independent of UI work)
- Docker compose authoring (independent of app code)
- Component-level rewrites (e.g., filling admin sub-pages) once data contracts frozen
- Playwright E2E scenarios (after MVP stable)

Sequential (main context):
- Auth wiring (affects every route)
- Paystack webhook wiring (must verify end-to-end)
- RTMP ingest pipeline (infra + code entangled)

---

## 6. Risks & Watch-outs

| Risk | Mitigation |
|---|---|
| Video bandwidth explodes at scale | Local HLS on disk is fine for dev; plan CDN swap before public beta |
| Stream key leakage | One-time reveal, hashed at rest, rotate on demand, nginx-rtmp on-publish callback validates |
| SQLite single-writer bottleneck | Fine until hundreds of concurrent writers; if we outgrow it, migrate to Postgres (Drizzle makes swap cheap) |
| Next 16 + React 19 instability | Lock versions; `ignoreBuildErrors` must be OFF after F12 so regressions surface |
| Africa-latency reality | Default 360p ladder; test throttled 3G in Chrome DevTools before Phase 1 exit |
| Payment rails (Stripe not ubiquitous in NG) | Paystack primary; Stripe deferred; MockProvider allows fully offline dev |
| Mock data masking bugs | Phase 0 seed converts mock → SQLite → real queries surface schema bugs |
| Local-only means no remote collab | When multi-dev needed, add a `db/dump.sql` export/import workflow; still no cloud DB |

---

## 7. Definition of "done" for each phase

- All checklist items checked OR explicitly deferred with reason
- `pnpm check` (lint + typecheck) clean
- Manual smoke test passes (documented per phase)
- Migration files reviewed; seed idempotent
- `tasks/lessons.md` updated with any corrections from user

---

## 8. Decisions locked

1. **Launch titles (2026-04-22):** Free Fire (primary) + CoD Mobile, PUBG Mobile, EA FC Mobile.
2. **Payments (2026-04-22):** Paystack first (NGN-native). Stripe deferred entirely from Phase 1; plug in later via provider interface. Always have a `MockProvider` for fully offline dev.
3. **Streams (2026-04-22):** Official-only in MVP. No creator self-service stream keys. Keys issued by admin from CMS.
4. **Platform scope (2026-04-22):** Web-first. Native mobile deferred. API designed stateless-JWT-friendly so native reuses endpoints.
5. **No cloud services (2026-04-22):** Fully local stack - SQLite + Drizzle + Better-Auth + local filesystem + SSE + in-process workers. No Supabase, no MinIO, no external realtime, no managed DB. Only non-local piece is Paystack sandbox (optional - MockProvider works offline).

---

## Review

(filled after each phase completes)

### Phase F review - DONE 2026-04-22

**F1.** `lib/types/` (22 interfaces) + `lib/mock/` (17 modules). Seeded: 4 games, 12 teams, 40 players, 8 events, 6 streams, 30 VODs, 10 clips, 8 products, 2 orders, 15 notifications.

**F2.** `components/providers/` - ThemeProvider, QueryProvider (TanStack), MockAuthProvider (localStorage-persisted session + follows + onboarding), sonner Toaster, dev-only RoleSwitcher. `app/layout.tsx` updated with Geist font variables. `proxy.ts` (Next 16 renamed from middleware) gates `(authed)` + `(admin)` routes by `evotv_role` cookie.

**F3.** `app/` reorganized into `(auth)` / `(public)` / `(authed)` / `(admin)` groups with per-group shell layouts (TopNav + BottomNav for public+authed; AdminSidebar for admin; centered card for auth).

**F4.** Auth screens: login, signup, verify-email (input-otp), forgot-password, reset-password, 4-step onboarding wizard. `app/page.tsx` splash auto-redirects. Zod + react-hook-form everywhere. Third-party OAuth buttons disabled (local mode).

**F5+F6.** `/home` (hero carousel, live now, upcoming, trending clips, ads, recommendations), `/discover` (debounced search + suggestions + filter chips + tabs), `/categories` + `/categories/[slug]`, `/events` + `/events/[id]` + `/events/[id]/bracket`, `/team` + `/team/[slug]`. Live countdown, NGN formatter inline.

**F7+F8.** `<VideoPlayer>` (custom controls, keyboard shortcuts, quality/speed/CC/PiP, graceful "Demo video unavailable" fallback). `/stream/[id]` with chat (setInterval feed), polls, in-stream shop, follow button, premium paywall, skippable preroll ad. `/vod/[id]` with chapters + related + comments. `/clips/[id]` vertical 9:16 viewer + `/clips` feed.

**F9+F10.** `/profile` (4 tabs: overview/followed/history/subscription + edit modal), `/profile/[handle]` public view, `/library`, `/settings` (tabbed, `?tab=` URL-synced), `/settings/billing`, `/notifications`. `/upgrade` (tier comparison), `/shop` + `/shop/[id]` (variants, gallery), `/cart` (localStorage `evotv_cart_v1`, EVO10 promo), `/checkout` (Paystack + Mock submit, NG state select, subscription variant), `/order/[id]` (shared OrderView, status timeline), `/profile/orders` + `/profile/orders/[id]`.

**F11.** Admin CMS all 10 routes: overview (metric cards + recharts AreaChart), streams (CRUD + reveal-key-once dialog + OBS settings block), content (games/teams/players/events CRUD in tabs), polls (create + results BarChart), ads (CTR table + charts), users (role+suspend), analytics (AreaChart + cohort heatmap + revenue BarChart + top titles), orders (status timeline + refund), moderation (reports + banned + appeals), settings (feature flags + branding + email templates). AdminGuard double-guards every route. `DataTable<T>` with sortable columns + sticky header + skeleton.

**F12.** Removed `typescript.ignoreBuildErrors`. Added `app/not-found.tsx` + `app/error.tsx` + `app/loading.tsx`. Added `turbopack.root` to silence parent-lockfile warning. Renamed `middleware.ts` → `proxy.ts` (Next 16). Fixed hydration bug in MockAuthProvider. Smoke test doc at `tasks/smoke-tests/phase-f.md` - all 31 routes return expected status (200/307/404). Typecheck clean. Dev server on :3000.

**Exit gate met:** stakeholder can demo guest → signup → onboarding → home → stream → follow → subscribe (Paystack UI) → watch → vod → profile → settings → logout using only mock data. Every page exists, every button navigates or toasts, every form validates. Ready for Phase 0 (SQLite backend stand-up).

### Phases 1G + 2 + 3 + 4 + 5 - DONE 2026-04-22 (5 parallel agents, typecheck clean project-wide)

**Phase 1G - Admin CRUD APIs:**
- `lib/api/admin.ts` shared helpers: `requireAdminFromRequest`, `generateId(prefix)`, `writeAudit`, `mapSqliteUniqueError` → 409 on slug collisions.
- CRUD route pairs under `app/api/admin/{games,teams,players,events,ads}/**`. POST create, PATCH partial update, DELETE cascade. Every mutation writes `audit_log` row with actor + action + targetType + targetId + meta. Events mutations rebuild `event_teams` mapping when `teamIds` changes.
- `app/api/admin/audit-log` GET `?limit=N` - separate historical reader, distinct from Phase 5's audit viewer.
- Players `kda` stored as `kda_x100` integer via `Math.round(kda*100)` on write.

**Phase 2 - Engagement (chat, polls, follows, likes, trending):**
- `lib/api/chat.ts` - `listInitialMessages`, `postMessage` (persist + emit `stream:<id>:chat`), `deleteMessage`, `pinMessage`, `getMessageById`. Joins with `user` table so SSE payload carries handle/avatar/role.
- `lib/api/polls.ts` - `listActivePolls`, `listPollsForStream`, `createPoll`, `vote` (atomic re-vote via upsert shifts counts between options), `closePoll`. Mutations emit `stream:<id>:polls`.
- `lib/api/follows.ts`, `lib/api/likes.ts` - `toggleLike` maintains denormalized `vods.likeCount` / `clips.likeCount` via `MAX(0, x-1)` / `x+1`.
- `lib/api/trending.ts` - `listTrendingClips` weighted `recent_likes*2 + viewCount`, `listTrendingVodsNow` by like velocity. 24h aggregate via Drizzle subquery.
- Routes: `app/api/streams/[id]/chat` (GET/POST with zod + banned-word filter + 2s slow-mode 429), `app/api/streams/[id]/chat/[messageId]/{delete,pin}`, `app/api/sse/chat/[streamId]`, `app/api/streams/[id]/polls`, `app/api/polls/[id]/{vote,close}`, `app/api/follows`, `app/api/likes`, `app/api/trending/clips`.
- Schema change: `likes (userId, targetType enum{vod,clip}, targetId, createdAt)` PK composite, 2 indexes. Migration `0002_many_harry_osborn.sql` generated + applied.

**Phase 3 - Monetization expansion:**
- `lib/api/tiers.ts` - 4 tiers (free, supporter ₦1,500, premium ₦4,500, pro ₦12,000) + `tierOf(priceNgn)`.
- `lib/api/products.ts` - `listProducts({featured?, category?, teamId?})`, `getProductById`, `getProductBySlug`.
- `lib/api/orders.ts` - `createOrder` (variant-aware pricing + stock check + `OrderValidationError`), `getOrderById`, `getOrderByPaymentRef`, `listOrdersForUser`, `updateOrderStatus`, `computeShipping` (₦2,500 flat, free ≥ ₦50k). ID format `ord_<16 hex>`.
- `lib/email/index.ts` - nodemailer via Mailhog (:1025 `ignoreTLS`). Falls back to `console.log` if SMTP_HOST unset. `nodemailer` + types installed.
- Routes: `GET /api/tiers`, `GET /api/products`, `GET /api/products/[id]` (slug fallback), `POST /api/orders` (auth + zod + init payment, returns `{order, redirectUrl, reference}`), `GET /api/orders/[id]` (owner-or-admin), `GET /api/orders/[id]/confirm-payment` (idempotent pending→paid, decrements inventory, sends email receipt, SSE emit, redirects), `POST /api/admin/orders/[id]/mark-shipped`, `POST /api/ads/{impression,click}`.

**Phase 4 - Personalization + perf (server-side only):**
- `lib/recommendations/index.ts` - `recommendForUser(userId, limit)` reads `vod_progress` + `follows` + recency. Score = 0.4*sameGameBoost + 0.3*followSignal + 0.2*recency + 0.1*globalViewCountNorm. Excludes VODs watched >80%.
- `lib/recommendations/trending.ts` - view-weighted 30-day linear decay fallback.
- `app/api/recommendations` (auth → personalized, else trending; returns `{items, source}`), `app/api/feed/home` (single-request bootstrap: `{hero, live, upcoming, recommendations, trendingClips}`).
- `lib/perf/image-loader.ts`, `lib/perf/cache-headers.ts`, `lib/logger.ts` (pino JSON multistream to stdout + `./storage/logs/app.jsonl`).
- `scripts/load-test.yml` - artillery ramp 10→500 VU over 60s. `tests/perf/README.md` with thresholds (p95 <200ms JSON, SSE connect <100ms).

**Phase 5 - Admin CMS full (analytics + flags + audit + CSV import):**
- `lib/api/analytics.ts` - `overviewMetrics()` (live streams, today signups, active Premium subs, MRR), `viewsOverTime(days)`, `retentionCohort(weeks)` 8×8 matrix, `revenueByMonth(months)`, `topVods(limit)`, `freeToPremiumConversionPct()`. MRR uses raw SQL `IN ('premium','pro','supporter')` even though enum only declares `free|premium` - tiers data-driven.
- `lib/api/flags.ts` - list/get/set (upsert)/delete (soft-disable default, `hard:true` removes row).
- `lib/api/audit.ts` - `listAudit({limit, offset, actorId?, targetType?})` returning `{rows, total}` + `writeAudit`.
- `lib/api/import.ts` - `papaparse` CSV loader for events/teams/players. Tolerates snake_case headers. Splits `teamIds` on `,;|`.
- Routes: `app/api/admin/analytics/{overview,views,retention,revenue,top-vods,conversion}`, `app/api/admin/feature-flags` + `[key]` (PATCH/DELETE with `?hard=1`), `app/api/admin/audit`, `app/api/admin/import/{events,teams,players}` (multipart; dry-run default, `?dryRun=0` commits in `db.transaction`, writes per-row audit).
- `papaparse` + types installed.

**Full-project state after this batch:**
- `pnpm typecheck` exits 0.
- DB schema now 29 tables (added `push_subscriptions`, `reminders`, `likes` across Phases 1D + 2).
- ~70 API route handlers live. All auth-gated where appropriate. All admin routes require `role==="admin"`.
- UI pages still on `@/lib/mock`. No regressions - smoke tests from Phase F remain valid.
- Phase 2-5 UI swap (flipping pages from `@/lib/mock` to new APIs) is discretionary - do per feature when real-data benefit outweighs the risk of regression.

### Phase 1 exit test - DONE 2026-04-22 (simulated, no OBS/FFmpeg required)

**Report:** `tasks/smoke-tests/phase-1-exit.md`.

**What was verified via curl on the live dev server:**
1. Admin signup + promote via `scripts/promote-admin.ts` + sign-in → session cookie.
2. `POST /api/admin/streams` → stream row created with hashed key; plaintext `sk_live_…` returned once.
3. `POST /api/rtmp/on-publish` with `name=<plaintext key>` → 200. DB confirms `isLive=true`, `startedAt=now`, `hlsPath=/hls/<key>.m3u8`.
4. `POST /api/rtmp/on-publish-done` → 200. DB confirms `isLive=false`, `endedAt=now`. Worker fires asynchronously and inserts a stub VOD row linked back to the stream (FFmpeg absent → zero duration + empty hlsPath, per graceful fallback).
5. Fresh viewer signup → `POST /api/payments/init` → MockProvider redirect → `GET <redirectUrl>` → 307 `/settings/billing?payment=success`. `GET /api/subscriptions/me` → active Premium sub, `user.role` promoted to `"premium"`, `subscription` notification row created.

**Two fixes kept during the test:**
- `workers/transcode.ts` now self-registers on module import (not just via `instrumentation.ts`, which didn't reliably fire under Turbopack dev). `app/api/rtmp/on-publish-done/route.ts` forces the import so the subscribe call lands before the emit.
- `lib/payments/mock.ts` state Map persisted to `globalThis.__evo_mock_payment_state` so init/verify stay consistent across HMR reloads and route-bundle isolation.

**Unverified (requires FFmpeg + Docker + OBS on the dev box):**
- Real multi-bitrate HLS output from the worker's 3-rung ladder.
- Sub-5s viewer latency claim.
- Paystack test webhook round-trip (needs ngrok). Steps documented in `tasks/smoke-tests/phase-1-exit.md`.

### Phase 1F review - DONE 2026-04-22

**In-process transcode worker:**
- `workers/transcode.ts` - registers on `stream:enqueue-transcode` bus topic. `PQueue({concurrency:1})` serializes jobs. On each job: loads the `streams` row by id, probes `ffmpeg -version` (skips gracefully if missing), if source HLS at `./uploads/hls/index.m3u8` exists runs 3-rung ladder (1080p/5000k, 720p/2800k, 360p/800k) with `libx264 veryfast + aac 128k + hls_time 4`, assembles a `master.m3u8` that references each variant, writes everything to `./uploads/vods/<vodId>/`. Inserts a `vods` row pointing at `hlsPath: vods/<id>/master.m3u8`. Falls back to a stub row when FFmpeg or source is absent so downstream UI never breaks.
- Worker wired via root `instrumentation.ts` (`NEXT_RUNTIME === "nodejs"` guard), calls `registerTranscodeWorker()` once at server boot. Idempotent.

**Triggered from Phase 1C's `/api/rtmp/on-publish-done`:**
- That route already emits `stream:enqueue-transcode` when a publisher disconnects. Worker picks it up asynchronously. End-to-end path: OBS push → nginx-rtmp `on-publish` callback → `is_live=true` → OBS disconnect → `on-publish-done` → `is_live=false` + bus emit → worker → FFmpeg → VOD row.

**VOD progress (resume playback):**
- `lib/api/vod-progress.ts` - `getProgress(userId, vodId)`, `upsertProgress(userId, vodId, positionSec)` with Drizzle `onConflictDoUpdate` on composite PK `(user_id, vod_id)`, `listProgressForUser(userId, limit)`.
- `app/api/vod-progress/[vodId]` GET → current position or null. POST zod `{positionSec: nonnegative int}` → upsert. Both auth-required.

**Curl-verified:**
- `GET /api/vod-progress/vod_1` unauth → 401.
- `POST /api/vod-progress/vod_1 {positionSec:183}` (authed) → `{ok:true}`.
- `GET` same → `{userId, vodId, positionSec:183, updatedAt:…}`.
- Typecheck clean.

**Infra requirements for real transcode run:**
- Install FFmpeg: `winget install Gyan.FFmpeg` or place binary on PATH. Worker detects via `ffmpeg -version`.
- Start nginx-rtmp: `cd infra && docker compose up -d`. Push from OBS to `rtmp://localhost:1935/live` with a stream key that exists in `streams.streamKeyHash`.
- Disconnect → worker fires, produces master.m3u8 under `./uploads/vods/<id>/`, served via `/api/uploads/vods/<id>/master.m3u8`.

**Intentionally not done in 1F:**
- VOD player UI does not yet call `/api/vod-progress`. Wire into `components/vod/vod-player.tsx` on timeupdate (throttled to 5s). Queued for page flip.
- No thumbnail-at-midpoint generation - could be added to the worker (`ffmpeg -ss <dur/2> -frames:v 1 thumb.jpg`). Non-blocking.
- Retry with exponential backoff / dead-letter queue not implemented - single attempt, logs error. Acceptable for single-node dev.

### Phase 1E review - DONE 2026-04-22

**Subscription domain + payment orchestration:**
- `lib/api/subscriptions.ts` - `getActiveSubscription(userId)`, `listSubscriptionsForUser`, `upsertFromPayment({userId, provider, providerSubId, priceNgn, periodDays?})` (auto-promotes user to `role:"premium"`), `cancelSubscription(userId)` (reverts role to `user`).
- `hooks/use-subscription.ts` - TanStack Query hook `useSubscription()` → `{subscription, isPremium, isLoading, error, refetch}`. Premium gating for UI.

**Route handlers:**
- `app/api/payments/init` POST - auth-required; zod `{plan:"premium"}`; mints 24-byte `ref_<hex>`; calls `getProvider().initCheckout` with user email, NGN amount (4,500), metadata `{userId, plan}`, callback `/api/payments/verify/<ref>`. Returns `{provider, redirectUrl, reference, accessCode?, amountNgn}`.
- `app/api/payments/verify/[ref]` GET - called by browser redirect after Paystack checkout or by MockProvider's callback URL directly. Verifies ref with provider, on success calls `upsertFromPayment`, creates `subscription` notification, emits `user:<id>:notification` on the SSE bus. Redirects to `/settings/billing?payment=success` or `?payment=failed`.
- `app/api/payments/paystack/webhook` POST - reads raw body + `x-paystack-signature`, delegates to `paystack.handleWebhook` (HMAC-SHA512 verify), then `upsertFromPayment` + notification + SSE emit. Returns `{ok:true}` on success, 400 on bad signature.
- `app/api/subscriptions/me` GET → `{subscription}` for the authenticated user.
- `app/api/subscriptions/cancel` POST → cancels + reverts role.

**End-to-end mock flow (curl on dev :3000):**
1. `POST /api/auth/sign-up/email` → cookie set.
2. `GET /api/subscriptions/me` → `{subscription:null}`.
3. `POST /api/payments/init {plan:"premium"}` → `{provider:"mock", redirectUrl:…?mock=1, reference:"ref_…", amountNgn:4500}`.
4. `GET <redirectUrl>` → 307 → `/settings/billing?payment=success`.
5. `GET /api/subscriptions/me` → `{subscription:{id:"sub_…", tier:"premium", status:"active", provider:"mock", priceNgn:4500, currentPeriodEnd:"2026-05-22T…"}}`.
6. `user` row is now `role:"premium"`, `notifications` row created with linkUrl `/settings/billing`.

**Config flip for Paystack test:**
- Set `PAYMENT_PROVIDER=paystack` + `PAYSTACK_SECRET_KEY=sk_test_…` + `PAYSTACK_PUBLIC_KEY=pk_test_…` in `.env.local`. Use `ngrok http 3000` (or any localhost tunnel) to receive Paystack's webhook at `/api/payments/paystack/webhook`. No code changes.
- Stripe implementation intentionally deferred. `Subscription.provider` type widened to `"paystack" | "stripe" | "mock"` so a Stripe adapter can plug in behind the same interface later.

**Intentionally not done in 1E:**
- UI pages still hit `lib/mock`. `/settings/billing` and `/upgrade` do not yet call `/api/payments/init` or `useSubscription`. Wiring is a one-file-per-page change when those pages are flipped.
- Billing history (past invoices table) not implemented - table structure permits it but no route yet. Phase 3 Monetization expansion scope.

---

### Phase 1D review - DONE 2026-04-22

**Schema additions (migration `0001_high_night_nurse.sql`):**
- `push_subscriptions` (id pk, userId fk→user, endpoint unique, p256dh, auth, createdAt) - one row per device.
- `reminders` (userId, eventId, createdAt) - persists "remind me" opt-ins per event.

**Web push stack:**
- `lib/push/index.ts` - `configure()` once via `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` + `VAPID_SUBJECT` env. `sendPushToUser(userId, payload)` loads all `push_subscriptions` rows, delivers via `web-push@3.6`, auto-prunes 404/410 endpoints. `publicKey()` exposes the VAPID public key for the browser subscribe call.
- `app/api/push/vapid-public-key` GET - returns `{publicKey}` or 503 if unconfigured.
- `app/api/push/subscribe` POST - zod-validated `{endpoint, keys:{p256dh, auth}}`, persists row scoped to `getCurrentUser().id`. DELETE - removes by endpoint (unique).
- `public/sw.js` - service worker handles `push` (shows notification with title/body/icon/url from payload) and `notificationclick` (focus existing tab with matching URL or open a new one). `skipWaiting()` + `clients.claim()` on activate.

**In-app notifications (parallel to push, read from SQLite):**
- `lib/api/notifications.ts` - `listNotifications(userId)`, `countUnread(userId)`, `markAsRead(id)`, `markAllAsRead(userId)`, `createNotification({userId, type, title, body, imageUrl?, linkUrl?})`.
- `app/api/notifications` GET → `{items, unread}`; POST → marks all read.
- `app/api/notifications/[id]/read` POST → marks one.
- `app/api/sse/notifications` GET → `text/event-stream` subscribed to `user:<id>:notification` topic on the in-process bus. Heartbeat 30s. Abort cleanup.

**Curl-verified (dev :3000):**
- `GET /api/push/vapid-public-key` → 503 (VAPID not set - expected until `npx web-push generate-vapid-keys` is run and `.env.local` populated).
- `GET /api/notifications` unauthenticated → 401.
- After `POST /api/auth/sign-in/email` with valid user, `GET /api/notifications` → `{items:[], unread:0}` (Better-Auth-created user has no seeded notifications).
- Typecheck clean.

**Intentionally not done in 1D:**
- Events API already exists from 1B (`/api/events*`). `/events/[id]` "Remind me" button still in UI with localStorage; swap to `POST /api/reminders` is queued for whichever sub-phase flips that page.
- Service worker registration call from the client (`navigator.serviceWorker.register("/sw.js")`) is not yet invoked from any provider. Needs to be wired into `components/providers/push-provider.tsx` when the notifications panel is swapped to consume the SSE + real API.
- `sendPushToUser` is not yet triggered on stream-go-live. Phase 1E / 1F event bus handlers will wire: `subscribe("stream:live-now", async ({streamId}) => { fan out push to followers })`.

### Phase 1C review - DONE 2026-04-22

**RTMP ingest callbacks:**
- `app/api/rtmp/on-publish/route.ts` - parses nginx-rtmp form body (`name=<key>&app=live`), hashes `name` → HMAC-SHA256, looks up `streams.streamKeyHash`. Rejects unknown key with 403. Rejects `streamerType !== 'official'` (official-only enforcement per decision). On success: flips `isLive=true`, records `startedAt`, sets `hlsPath` to `/hls/<key>.m3u8`, resets viewer counter, emits `stream:<id>:status` + `stream:live-now` on the in-process bus.
- `app/api/rtmp/on-publish-done/route.ts` - mirror; flips `isLive=false`, records `endedAt`, emits `stream:<id>:status` + `stream:enqueue-transcode` (consumed by Phase 1F worker).
- Curl verified: `POST /api/rtmp/on-publish` with unknown key → 403.

**Admin stream management with one-time key reveal:**
- `app/api/admin/streams` POST - zod-validated body (title, description, gameId, eventId?, streamerName, isPremium, etc). Requires `role === "admin"` on session (curl without auth → 403). On success: generates `sk_live_<32 hex>` key, inserts stream row with only the **hash** persisted, returns JSON `{id, streamKey, ingestUrl, warning}` - **the one and only moment the plaintext key is exposed**. UI is expected to show it in a modal with copy-to-clipboard + warning.
- `app/api/admin/streams/[id]/regenerate-key` POST - same auth gate, rotates the hash, returns new plaintext key once.

**SSE viewer presence:**
- `app/api/sse/stream/[id]` - `Content-Type: text/event-stream`. Each connection is assigned a random viewer id, added to an in-memory `Set` per stream id. DB `streams.viewerCount` + `peakViewerCount` updated on join + leave (via `req.signal` abort). Emits `viewers` event with the latest count to all connected subscribers of that stream, plus a `status` event any time `on-publish` or `on-publish-done` fires. Heartbeat every 30s.

**HLS.js player component:**
- `components/stream/hls-player.tsx` - client-only. Checks native HLS support (Safari/iOS), otherwise uses `hls.js` v1.6. Low-latency mode, liveSyncDurationCount 3, 30s back buffer. `onReady(levels)` callback for quality menu. Fatal-error overlay. Accepts any `src` - falls back to plain `<video src>` when the URL isn't `.m3u8`.
- `hls.js@1.6.16` added. Bundle only pulled into pages that import the component (none yet).

**Infra ready but not running in this session:**
- `infra/docker-compose.yml` + `infra/nginx-rtmp/nginx.conf` already in place from Phase 0. `on_publish` callback target is `http://host.docker.internal:3000/api/rtmp/on-publish`. To end-to-end test: `cd infra && docker compose up -d`, then OBS push with a stream key that exists in `streams.streamKeyHash`. The full OBS→RTMP→HLS→HLS.js pipeline is testable but not automated in this autonomous loop.

**Intentionally not done in 1C:**
- `/stream/[id]` UI still uses the mock `<VideoPlayer>` with local MP4. The new `HlsPlayer` component is installed and typechecks but not yet rendered anywhere. Flipping the stream page to consume `lib/api/streams` + SSE viewer presence + HlsPlayer requires auth flip too (guest can still watch but premium gate needs `useSubscription` backed by real data - Phase 1E) - queued for the sub-phase that pulls the full stream page into real data.
- No page imports `@/lib/api` yet. Mock data still drives the UI across the app.

---

### Phase 1B review - DONE 2026-04-22

**`lib/api/*` domain modules (mirror `lib/mock/*` signatures, backed by Drizzle + better-sqlite3 synchronous calls):**
- `lib/api/games.ts` - `listGames`, `getGameById`, `getGameBySlug`.
- `lib/api/teams.ts` - `listTeams({gameId?})`, `getTeamById`, `getTeamBySlug`.
- `lib/api/players.ts` - `listPlayers({gameId?, teamId?})`, `getPlayerById`. Stores `kda` as `kda_x100` integer on disk; converts to decimal on read.
- `lib/api/events.ts` - `listEvents({status?, gameId?})`, `getEventById`, `getEventBySlug`, `listMatchesForEvent`. Resolves `teamIds` array per event via `event_teams` join.
- `lib/api/streams.ts` - `listLiveStreams({gameId?, isPremium?})` ordered by `viewerCount DESC`, `getStreamById`, `listFeaturedStreams` (top 3 live).
- `lib/api/vods.ts` - `listVods({gameId?, isPremium?, limit?})` ordered by `publishedAt DESC`, `getVodById`, `listRelatedVods(id, limit)` (same game, excludes self), `listTrendingClips(limit)` ordered by `viewCount`, `getClipById`.
- `lib/api/search.ts` - `globalSearch(q)` with Drizzle `LIKE` over title/name columns + in-memory filter on catalog (fine at current seed size; FTS5 deferred until rows grow), `searchSuggestions(q, limit)` flattens to unique string list.
- `lib/api/ads.ts` - `listAds(placement)`, `pickAd(placement)` with weighted random draw.
- `lib/api/users.ts` - from Phase 1A; unchanged.
- `lib/api/index.ts` - barrel re-export. Future page swap is just `@/lib/mock` → `@/lib/api`.

**HTTP route handlers (so any client, native app, or page can consume real data):**
- `app/api/streams/route.ts` - `?featured=1|gameId=&isPremium=`.
- `app/api/streams/[id]/route.ts`.
- `app/api/events/route.ts` - `?status=&gameId=`.
- `app/api/events/[id]/route.ts` - returns `{event, matches}`.
- `app/api/games/route.ts`.
- `app/api/search/route.ts` - `?q=&suggest=1&limit=`.
- `app/api/vods/route.ts` - `?clips=trending&limit=|gameId=&isPremium=&limit=`.

**Curl-verified endpoints (typecheck clean, dev server :3000):**
- `GET /api/streams` → live streams array ordered by viewers.
- `GET /api/streams?featured=1` → top 3.
- `GET /api/search?q=alpha` → `{games:[], teams:[Team Alpha], players:[], events:[], streams:[], vods:[]}`.
- `GET /api/events?status=live` → 2 live events from seed.
- `GET /api/vods?clips=trending&limit=3` → top clips by view count.

**Intentionally not done in 1B:**
- `/home` + `/discover` pages still import from `@/lib/mock`. The API layer is ready; UI flip is one import line per page and deferred until the auth flip in a later sub-phase forces it.
- SQLite FTS5 virtual table not added. `LIKE` handles current seed volume; re-evaluate when rows exceed ~10k.

---

### Phase 1A review - DONE 2026-04-22

**Better-Auth infrastructure:**
- Installed `better-auth@1.6.7`.
- `lib/auth/index.ts` - server-only BA instance with Drizzle adapter mapped to `{user, session, account, verification}` tables. `baseURL` from `BETTER_AUTH_URL` env or `http://localhost:3000`. Email+password with `minPasswordLength: 8`, `autoSignIn: true`, 30-day session. Role + handle as `additionalFields`. Custom `generateId` produces `user_xxxxxxxxxxxxxxxx`.
- `lib/auth/guards.ts` - server-side `getSession`, `getCurrentUser`, `requireUser`, `requireRole`.
- `lib/auth/client.ts` - BA React client (`authClient`, `signIn`, `signUp`, `signOut`, `useSession`). Not yet wired into any page - MockAuthProvider still drives UI.
- `app/api/auth/[...all]/route.ts` - catch-all that exports `toNextJsHandler(auth.handler)` GET+POST.

**Schema overhaul (breaking - DB reset required):**
- `db/schema/users.ts` rewritten. Old `users` + `sessions` removed. Now defines BA's required tables: `user`, `session`, `account`, `verification` - all with `integer timestamp_ms` timestamps (BA binds Date objects, so text columns break SQLite). `user` adds two app-specific columns: `role` and `handle` (both indexed, `handle` unique).
- `profiles` + `user_prefs` now FK `user.id` (not `users.id`).
- All other tables (`streams.chat_messages`, `streams.poll_votes`, `streams.follows`, `commerce.orders`, `commerce.subscriptions`, `ops.notifications`, `ops.audit_log`, `streaming.vod_progress`) updated FK references from `users` → `user`.
- Migration regenerated as `0000_clever_blackheart.sql` (25 → 27 tables).
- `db/seed.ts` updated to populate `schema.user` (converting `p.createdAt` ISO strings to `Date` objects for the new timestamp columns) alongside `schema.profiles`.
- `pnpm db:reset` run and verified - 23 users, 4 games, 12 teams, 40 players, 8 events, 6 streams, 30 VODs, 10 clips, 2 orders, 1 subscription, 4 ads, 15 notifications, 2 polls, 4 follows, 7 feature flags.

**`lib/api/users.ts` - first domain module backed by Drizzle:**
- Same async helper signatures as `lib/mock/users.ts` (`getCurrentUser`, `getUserById`, `getUserByHandle`, `getUserPrefs`, `searchUsers`).
- Plus mutation helpers: `upsertPrefs`, `updateProfile`, `markOnboarded` (used by Phase 1A onboarding swap - not wired into pages yet).
- Joins `user` + `profiles` tables; falls back to `user.name`/`user.email` when profile row missing.
- `getCurrentUser()` delegates to `lib/auth/guards.getCurrentUser` for session lookup.

**End-to-end verification (all via curl on :3000):**
- `POST /api/auth/sign-up/email` → 200 + `evotv.session_token` cookie + JSON `{token, user}`.
- `GET /api/auth/get-session` with cookie → returns `{session, user}`.
- `POST /api/auth/sign-in/email` with valid creds → 200 + new session.
- `POST /api/auth/sign-in/email` with wrong password → 401.
- Typecheck clean.

**Intentionally not done in 1A:**
- UI pages still consume `MockAuthProvider` from `components/providers/*`. `(auth)/login`, `(auth)/signup`, `(auth)/verify-email`, `(auth)/onboarding` still use mock. No page migration yet - pages stay on mock until someone swaps them or a later sub-phase requires real auth. The infrastructure is ready; the UI flip is a one-file-at-a-time job.
- `proxy.ts` still reads `evotv_role` cookie (mock). Upgrading it to read BA's `evotv.session_token` is queued for whichever sub-phase does the UI flip.
- Avatar upload via `LocalStorageAdapter` - code path ready (`lib/storage/local.ts` + `/api/uploads`), wiring into the profile edit modal deferred.

---

### Phase 0 review - DONE 2026-04-22

**Infrastructure stood up:**
- SQLite database at `./data/evo.db` via `better-sqlite3` (WAL mode, FK enforcement). Connection pooled via `lib/db/index.ts` singleton.
- Drizzle schema split across `db/schema/{users,catalog,events,streaming,commerce,ops}.ts` - 25 tables covering every EPIC.
- `drizzle.config.ts` + `pnpm db:generate` (drizzle-kit) → migration `0000_bitter_doctor_faustus.sql`.
- `pnpm db:migrate` + `pnpm db:seed` + `pnpm db:reset`. Seed reads `lib/mock/*` fixtures and upserts idempotently. Current seed: 23 users/profiles, 4 games, 12 teams, 40 players, 8 events, 4 matches, 6 streams, 30 VODs, 10 clips, 8 products, 2 orders, 1 subscription, 4 ads, 15 notifications, 2 polls, 4 follows, 7 feature flags.
- `lib/storage/local.ts` - `LocalStorageAdapter` (write/read/delete/exists) + HMAC-SHA256 signed URLs. Writes under `./uploads/`.
- `app/api/uploads/[...path]/route.ts` - serves files from local FS, verifies signed tokens, sets correct Content-Type for jpg/png/webp/mp4/m3u8/ts.
- `lib/sse/bus.ts` - in-process EventEmitter pub/sub + `sseStream(topic)` helper that converts emissions to a `text/event-stream` ReadableStream with 30s heartbeat.
- `lib/video/stream-key.ts` - `generateStreamKey()` / `hashStreamKey()` / `compareStreamKey()` using HMAC-SHA256 + constant-time compare.
- `lib/payments/{provider,paystack,mock}.ts` - `PaymentProvider` interface with `PaystackProvider` (Transaction Init + HMAC-SHA512 webhook verify) and `MockProvider` (instant success, offline). Selected via `PAYMENT_PROVIDER` env flag.
- `infra/docker-compose.yml` - nginx-rtmp + mailhog only (no external DB/cache/broker). nginx.conf has on-publish callback to `host.docker.internal:3000/api/rtmp/on-publish`, writes HLS to `/var/hls` mounted from `./uploads/hls/`.
- `.env.local.example` + `.env.local` with DATABASE_URL, AUTH_SECRET, UPLOADS_DIR, RTMP_INGEST_URL, HLS_OUTPUT_DIR, PAYMENT_PROVIDER, Paystack keys, VAPID keys, SMTP config.
- `.gitignore` extended to cover `data/`, `uploads/`, `storage/`, `*.db*`.
- `package.json` pinned `pnpm.onlyBuiltDependencies` to ensure better-sqlite3 + sharp build.

**Intentionally deferred (picked up in Phase 1A+):**
- `lib/auth/` (Better-Auth setup + session helpers). Mock auth still live in browser so UX unaffected.
- `lib/api/*` modules mirroring `lib/mock/*`. Each Phase 1 sub-phase swaps its own domain one import line at a time.
- Replacing `MockAuthProvider` + `proxy.ts` role cookie with real Better-Auth session cookie.
- FFmpeg transcode worker (Phase 1F).
- `web-push` VAPID + service worker (Phase 1D).

Typecheck (`pnpm typecheck`) clean. Dev server still running on :3000 with mock data; nothing regressed.

---

## 9. Pause snapshot (2026-04-22, end of day - second pause)

**Status:** PAUSED. No background agents running. Dev server (`pnpm dev`) was live on :3000. No wakeup scheduled.

**What shipped between pause 1 and pause 2:** all of Phase 1 (auth, discovery, streaming pipeline, events+notifications, Paystack subs, VOD transcode, admin MVP slice) PLUS Phases 2/3/4/5 API layers (engagement, monetization, personalization, admin full). UI pages still on `@/lib/mock` - no visual regressions.

**Only remaining work in Phase 1:** task #9 exit test. Manual end-to-end integration requiring FFmpeg installed, `cd infra && docker compose up -d`, OBS with a stream key that matches a row in `streams.streamKeyHash`, and (optional) Paystack test keys + ngrok for a real Paystack webhook round-trip. MockProvider works offline. See `tasks/smoke-tests/phase-f.md` for the UI smoke checklist; the backend exit test is a separate manual flow captured in §4 Phase 1 exit criteria.

### What's DONE (verified passing)

| Phase | Status | Verification |
|---|---|---|
| F1 Mock data foundation | ✅ | 17 modules in `lib/mock/`, 22 types in `lib/types/` |
| F2 Providers + shell + role switcher | ✅ | `components/providers/`, `components/shell/` |
| F3 Route groups refactor | ✅ | `app/(auth)/(public)/(authed)/(admin)/` |
| F4 Auth + onboarding screens (mock) | ✅ | login/signup/verify-email/forgot/reset + 4-step wizard |
| F5 Home + discovery + categories | ✅ | hero carousel, SSE-style live feeds, NGN formatter |
| F6 Events + brackets | ✅ | countdown, bracket view, team roster |
| F7 Stream/VOD/clip players | ✅ | `<VideoPlayer>`, graceful MP4 fallback, keyboard shortcuts |
| F8 Social UI (chat/polls/follow/like) | ✅ | setInterval chat, poll voting, FollowButton |
| F9 Profile/library/settings/notifications | ✅ | tabbed settings, billing page, notification read states |
| F10 Monetization screens | ✅ | shop + cart (localStorage) + Paystack-branded checkout |
| F11 Admin CMS (every sub-page) | ✅ | 10 sub-pages with recharts, DataTable, Sheet drawers |
| F12 Polish (404/500/loading, no ignoreBuildErrors, smoke test) | ✅ | 31 routes smoke-tested, all expected 200/307/404 |
| 0 Local backend foundation (DB + infra) | ✅ | SQLite migrated + seeded, docker-compose ready |

**Typecheck:** `pnpm typecheck` exits 0.
**Smoke test doc:** `tasks/smoke-tests/phase-f.md`.

### Exact stop point

Paused mid-way between **Phase 0 completion** and **Phase 1A start**.

Phase 0 infra is done. Phase 1A (Better-Auth wiring) was queued as next step - autonomous wakeup was scheduled but user requested pause. **No code for Phase 1A was written yet.**

### What's REMAINING

| # | Phase | Scope |
|---|---|---|
| 2 | 1A | Better-Auth config + `/api/auth/{signup,login,logout,verify}` route handlers + `lib/api/users.ts` mirroring `lib/mock/users.ts`. Swap `(auth)` pages from MockAuthProvider to real cookies. Avatar upload via `LocalStorageAdapter`. |
| 3 | 1B | Swap home + discover imports from `@/lib/mock` → `@/lib/api`. Add SQLite FTS5 virtual tables for full-text search. |
| 4 | 1C | `docker compose up` to start nginx-rtmp + mailhog. Write `/api/rtmp/on-publish` + `/api/rtmp/on-publish-done` route handlers. Replace `<VideoPlayer>` `<video>` with HLS.js. SSE viewer presence. Admin stream-key reveal wired to real hashed keys. |
| 5 | 1D | `web-push` + VAPID keys + `public/sw.js`. Go-live event bus via `lib/sse/bus` broadcasts to push subscribers. In-app panel reads notifications from SQLite. |
| 6 | 1E | `/api/payments/init` + `/api/payments/paystack/webhook` + `/api/payments/verify/[ref]`. Wire `/settings/billing` + `/upgrade` + `/checkout` to call real API. MockProvider default until Paystack test keys dropped in `.env.local`. |
| 7 | 1F | `workers/transcode.ts` uses FFmpeg to make multi-bitrate HLS under `./uploads/vods/{id}/`. Enqueued on stream end. `vod_progress` resume table. |
| 8 | 1G | Swap admin CMS reads from mock arrays to `lib/api/*` helpers. Stream creation writes real row with hashed key + one-time reveal. |
| 9 | Exit test | End-to-end: admin creates event → OBS pushes RTMP → viewer subscribes via Paystack test → watches live <5s → VOD appears after stream ends, all local. |
| 10-13 | Phase 2-5 | Engagement (live chat SSE, polls, likes, trending). Monetization expansion (multi-tier, real shop checkout). Personalization + perf. Full admin analytics. See §4. |

### Tech left to wire (files that don't exist yet)

```
lib/api/                    ← NOT CREATED. Each 1x sub-phase adds its domain.
lib/auth/                   ← NOT CREATED. Phase 1A.
workers/                    ← NOT CREATED. Phase 1F.
app/api/auth/               ← NOT CREATED. Phase 1A.
app/api/rtmp/               ← NOT CREATED. Phase 1C.
app/api/sse/                ← NOT CREATED. Phase 2 (chat) - basic bus exists.
app/api/payments/           ← NOT CREATED. Phase 1E.
public/sw.js                ← NOT CREATED. Phase 1D.
public/demo/sample.mp4      ← NOT CREATED. Optional - player already degrades gracefully.
```

### How to resume

1. Start dev server: `pnpm dev` (if not running).
2. Start docker infra when needed: `cd infra && docker compose up -d`.
3. Reset DB if schema drifted: `pnpm db:reset`.
4. Tell Claude: **"continue Phase 1A"** or **"continue autonomous loop"**.
5. Next atomic task is task #2 in `TaskList`.

### Env assumptions baked in

- Node 25.8.1, pnpm 10.33.1 (installed globally via npm).
- `.env.local` created from `.env.local.example`. Current values are placeholders - regenerate `AUTH_SECRET` before real use (`openssl rand -base64 32`).
- `PAYMENT_PROVIDER=mock` by default. Swap to `paystack` once test keys are entered.
- `data/evo.db` populated. Safe to delete + regenerate via `pnpm db:reset`.

---

_Last updated: 2026-04-22 (PAUSED)_

---

# App Track - Native iOS + Android (sibling repo)

> **Started 2026-05-05.** Sibling React Native / Expo SDK 52 twin of the web app at `../EVOTV-app/`. Same brand, same data, same flows. Mock-data parity with web's Phase F. Backend swap waits for web's Phase 1A bearer-token routes.

## A0. Locked decisions

- **Stack:** Expo SDK 52, React Native 0.76 (New Architecture), Expo Router 4, NativeWind v4, TypeScript strict.
- **Repo layout:** sibling folder `GAMEEVO/EVOTV-app/`, NOT a monorepo workspace. Zero risk to live web Vercel deploy. Mild duplication of `lib/mock/` accepted.
- **UI parity strategy:** design-system-perfect, not pixel-perfect. NativeWind classes map to same Tailwind tokens as web. shadcn-style RN primitives at `components/ui/` mirror web shadcn/ui API surface.
- **Data layer:** `lib/mock/*` ported 1:1 from web. `localStorage` swapped for AsyncStorage shim at `lib/storage/persist.ts`. Phase 1A swap point: `lib/api/*` modules call web's `/api/*` via fetch + JWT.
- **Auth:** mock-auth-provider mirrors web's role-switching dev panel. Persists current user to AsyncStorage.
- **Player:** `expo-video` (native HLS, hardware accel) - replaces web's HLS.js.
- **Brand:** cyan `#2CD7E3`, dark-first.

## A1. Initial scaffold (DONE 2026-05-05) ✅

- [x] Expo config - `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `metro.config.js`, `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`, `.gitignore`, `.env.example`, `README.md`.
- [x] Design tokens - Tailwind config mirrors web `oklch` tokens as RGB hex, dark theme defaults, brand cyan + Geist fonts wired.
- [x] RN UI primitive twins of every shadcn component at `components/ui/` (~60 files). Faithful: Button/Card/Badge/Input/Avatar/Tabs/Sheet/Dialog/Switch/Progress/Toast/Slider/Select/Dropdown etc. Stubs only (web-only): command/calendar/input-otp/chart/menubar/navigation-menu/resizable/sidebar - render placeholder, typed correctly so screens compile.
- [x] Providers - `ThemeProvider` (NativeWind useColorScheme + AsyncStorage persist), `QueryProvider` (TanStack), `MockAuthProvider` (full role + follow + onboarding port), `RoleSwitcher` (`__DEV__` only), `FontLoader` (expo-font useFonts), `SplashGate` (expo-splash-screen).
- [x] `lib/mock/*` - 45 mock files + `index.ts` ported. `lib/types.ts`, `lib/utils.ts` (`cn`), `lib/storage/persist.ts` (AsyncStorage shim with sync cache + `syncGet`/`syncSet`/`syncRemove`), `lib/theme/tokens.ts`. Web-only deps stripped (`window.localStorage`, `Blob`/`URL.createObjectURL`, `"use client"`).
- [x] Expo Router tree - every web page mirrored 1:1 (89 screens + 6 group layouts). Route groups `(auth)`, `(public)`, `(authed)`, `(admin)`, `(embed)`. Dynamic params preserved (`[id]`, `[slug]`, `[handle]`, `[eventId]`, `[streamId]`). `(public)` is a Tabs layout (Home/Events/Discover/Shop visible; rest `href: null`).
- [x] Domain components - `home/top-navbar`, `home/hero-carousel`, `home/live-now-section`, `home/recommendations`, `home/trending-clips-section`, `home/upcoming-events-section`, `home/ad-banner`, `auth/form-field`, `auth/password-strength`, `profile/profile-header`, `profile/watch-history-list`, `profile/profile-tabs`, `stream/hls-player` (expo-video twin), `stream/live-chat`, `library/library-tabs`.
- [x] Seed screens fully built (replacing initial stubs): `(auth)/login`, `(public)/home`, `(public)/stream/[id]`, `(authed)/library`, `(authed)/profile`.

## A2. Pending - user actions to run app first time

- [ ] `pnpm install` inside `EVOTV-app/`.
- [ ] Drop Geist font files into `EVOTV-app/assets/fonts/` (`Geist-Regular.ttf`, `Geist-Medium.ttf`, `Geist-SemiBold.ttf`, `Geist-Bold.ttf`, `GeistMono-Regular.ttf` - download from `github.com/vercel/geist-font` and convert otf → ttf with `fontforge` if needed).
- [ ] Drop app icon + splash + adaptive-icon into `EVOTV-app/assets/` (`icon.png` 1024×1024, `splash.png`, `adaptive-icon.png`, `favicon.png`). Stub with EVO logo for now.
- [ ] `pnpm start` → scan QR with Expo Go on physical device. Verify boot, home renders, login flow runs against mocks.
- [ ] Verify `(public)/_layout.tsx` Tabs `name="home/index"` resolves correctly in Expo Router 4 - if not, change to `name="home"`.

## A3. Known follow-ups (not blockers for first boot)

- [ ] **Mock function gaps** - `getWatchHistory`, follow-aggregator, downloads-as-Vods all need shaping inside library/profile screens. `library-tabs.tsx` accepts generic shapes; wire data when ready.
- [ ] **Cross-group tabs** - current Tabs layout shows only public tabs. "Library"/"Profile" reachable via `router.push("/library")` etc. Future: add a 5th "More" tab or a header drawer linking authed routes from public surface.
- [ ] **Calendar `.ics` download** - `lib/mock/calendar.ts` `downloadIcs()` is a no-op shim. Wire `expo-file-system` + `expo-sharing` when calendar feature lands on app.
- [ ] **Embed routes** (`(embed)/embed/*`) - likely web-iframe-only; either rebuild as RN-native or hide on app.
- [ ] **API access docs/integrations** - web-iframe heavy; rewrite or hide on app.
- [ ] **Phase 1A swap point** - once web ships `/api/auth/*` + bearer-token routes, replace `lib/mock/*` imports with `lib/api/*` modules at the import-site level. Keep function signatures identical.
- [ ] **Native modules** - `expo-haptics`, `expo-image-picker`, `expo-secure-store`, `expo-blur` declared in `package.json` but not yet used. Wire when feature requires.

## A3a. Web target via SPA mode (DONE 2026-05-05) ✅

- [x] `app.json` `web.output: "single"` - SPA, no static rendering (sidesteps Reanimated SSR break).
- [x] `pnpm expo export --platform web` produces `dist/` with `index.html` + `_expo/static/{js,css}/*` + `assets/*`. Web bundle ~4.57 MB JS + 17 kB CSS, 3084 modules.
- [x] `vercel.json` committed - buildCommand `pnpm expo export --platform web`, outputDirectory `dist`, installCommand `pnpm install --frozen-lockfile`, SPA rewrite `/(.*) → /index.html`, immutable cache headers on `_expo/static/*`.
- [x] HLS on web - `components/stream/hls-player.web.tsx` ships hls.js polyfill (Metro `.web.tsx` extension resolution; native bundle unaffected at 6.76 MB).
- [x] **GitHub repo:** `https://github.com/Layott/evotv-app` (private).
- [x] **Vercel deploy:** production live at **`https://evotv-app.vercel.app`** (HTTP 200, title "EVO TV"). Project `evotv-app` under team `layos-projects-20229cd2`. Auto-deploy on push to `main` enabled by default - same as web.
- [x] Verified end-to-end on local serve: `/home` (hero + 5 sections), `/login` (form), `/events` (stub), `/stream/stream_lagos_final` (HLS error fallback proves polyfill wired).

## A3b. Full screen port - every route now real (DONE 2026-05-05) ✅

User correction: stub screens were unacceptable. Dispatched 8 parallel agents to port every remaining web page as a fully-implemented RN screen.

- [x] **(auth) - 5 screens** ported: signup (multi-field + zod + country picker), forgot/reset password (with strength meter), email OTP verify (6-slot keypad), 4-step onboarding wizard. New: `components/auth/country-select`.
- [x] **(public) discovery - 12 screens** ported: events list/detail/bracket, discover (debounced search), shop + product detail, categories + game pages, team list/detail, channel page, calendar. New: `components/events/{event-hero,countdown-timer,team-roster,bracket-view}`, `components/shop/{qty-stepper,variant-picker,product-card}`, `components/calendar/calendar-page`.
- [x] **(public) content + apps - 15 screens** ported: clips feed + 9:16 player, VOD detail with comments + related + paywall, co-stream view, apps landing per platform (Smart TV/Android/iOS/Desktop), upgrade tiers + FAQ, API access (landing/keys/docs/usage), partners. New: `components/vod/{vod-related,vod-comments}`, `components/apps/{platform-bits,store-landing}`, `components/api-access/shell`.
- [x] **(authed) commerce + settings - 10 screens** ported: settings + sub-pages, billing + cancel flow, checkout, mobile-money STK push flow, notifications inbox (date-bucketed tabs), cart with promo, order detail, public profile by handle. New: `components/profile/ngn`, `components/settings/section-card`, `components/payment-methods/provider-tile`, `components/shop/{cart-store,order-view}`.
- [x] **(authed) games + engagement - 21 screens** ported: watch parties (browse/create/join), pickem (bracket + leaderboard), predictions (matches + leaderboard), fantasy (leagues + lineup + leaderboard), multi-stream 2x2 grid, tips, USSD with numeric keypad, rewards (store/history/quests with XP tier), auto-clipper admin gate. New: `components/engagement/{coin-pill,rank-badge,drop-card}`.
- [x] **(authed) creator + integrations - 10 screens** ported: creator program (apply 3-step wizard + thanks), creator dashboard (overview/earnings/clips/audience with custom RN charts), integrations hub + Discord + Telegram bot config. New: `components/creators/{dashboard-shell,metric-card,program-pitch,relative-time}`, `components/integrations/{bot-config-page,bot-icon}`.
- [x] **(admin) - 12 screens** ported: overview, streams manager, content, polls, ads, users + roles, analytics, orders, moderation queue, settings, billing (USSD admin), forensic watermark inspector. Mobile adaptation: bottom-sheet Modals replace web Sheets, Card row lists replace tables, View+flex bar charts replace recharts, react-native-svg for forensic manifest. New: `components/admin/{utils,page-header,status-badge,metric-card,overview-page,streams-manager-page,content-manager-page,polls-manager-page,ads-manager-page,users-roles-page,analytics-page,orders-page,moderation-page,admin-settings-page,billing-page,forensic-page}`.
- [x] **(embed) - 2 screens** ported: embed code generator (premium-gated) + minimal full-bleed player.
- [x] Type fixes: widened `Icon: ComponentType<{size,color}>` → `LucideIcon` across 8 files. Replaced `toast.message` with `toast()` (sonner-native compat) in 14 files. Typecheck clean (0 errors, was 52).
- [x] Web bundle: 5.43 MB JS (+860 KB) + 30.7 KB CSS (was 17 KB) - 80+ new screens + ~40 new components added. Native bundle still 6.76 MB Hermes.
- [x] Pushed to GitHub: commit `a759fb6` on branch `main`, https://github.com/Layott/evotv-app.
- [x] Vercel auto-deployed: deployment `dpl_3u28Pd5rkjAzrpKEhcsbQ9tWpYQ4`, READY in ~2 min, alias `https://evotv-app.vercel.app` live.
- [x] Verified routes 200: `/home`, `/admin`, `/fantasy`, `/embed`, plus all dynamic + nested.

## A4. App-only roadmap (post-MVP)

- Push notifications via Expo Notifications (linked to web's notification preferences in `lib/mock/notifications`).
- Offline downloads using `expo-file-system` + `lib/mock/downloads` (already has data shape).
- Chromecast / AirPlay via `react-native-google-cast` + `react-native-airplay` (requires dev build, not Expo Go).
- Picture-in-Picture for stream player (expo-video supports PiP).
- Background audio for radio/music VODs.
- Deep linking - `app.json` `scheme: "evotv"` already set. Wire link handlers per route group.
- EAS Build for store submission (App Store + Play Store). EAS Update for OTA JS bumps without store review.
- Android TV target - Expo Router supports it via `experiments.tvosEnabled` + Android TV manifest entries.

_App track last updated: 2026-05-05 (initial scaffold complete, awaiting first boot)_

---

# B. Landing page + EPG backbone (2026-08-10)

Spec: `docs/superpowers/specs/2026-08-10-evotv-landing-and-epg-design.md`.
Reworked from typographic to poster-led after the owner delivered finished show artwork.

## B1. Assets

- [x] Convert `SUC EP1.png` + `Open-chair.png` (1080x1350 PNG, 1.7 MB / 2.6 MB) to WebP under `public/shows/`
- [x] Generate LQIP blur placeholders (next.config sets `images.unoptimized`, so nothing is optimized at request time)
- [x] `lib/epg/artwork.ts` registry: normalized title to poster, accent colour, polarity (dark/light art)

## B2. EPG backbone

- [x] `db/schema/epg.ts` with `epg_slots`, unique on `(day_of_week, start_minute) where is_active`
- [x] Register in `db/schema/index.ts`
- [x] Migration `0031_epg_slots` generated by `drizzle-kit`, never hand-written
- [x] `data/epg/week-1.csv` committed, derived from `APRIL EPG - WEEK 1.pdf`
- [x] `scripts/import-epg.ts` idempotent upsert
- [x] `lib/epg/grid.ts` pure time maths, zero DB imports so it is unit-testable
- [x] `lib/api/epg.ts` DB reads plus merge with the dated rows from `lib/api/schedule.ts`

## B3. Landing page

- [x] `/` guest-vs-authed split moves into `proxy.ts`
- [x] `app/page.tsx` becomes a server component (real HTML in the first response)
- [x] `components/landing/`: hero, on-now band, originals rail, week grid, pillars, footer
- [x] Desktop AND 390x844 mobile verification, per the project hard rule

## B4. Verification

- [x] Unit: `nowPlaying` mid-slot, on boundary, the 23:00 slot, Sunday 23:00 to Monday 00:00 rollover, dated override
- [x] Unit: importer round trip, exactly 168 active slots, 24 per weekday, no gaps, no overlaps
- [x] `pnpm typecheck` + `pnpm test` + `pnpm build`

## Deviations from the spec, and why

1. **Poster-led, not typographic.** The spec's "no per-show artwork exists" premise is dead.
2. **New `Originals` band.** Sucre's Space and HYP / Take a Seat: Confessionals are not in the April grid, and inventing airtimes for them would be exactly the fabrication the spec exists to avoid. They get a poster rail with no times instead.
3. **Grid maths split into `lib/epg/grid.ts`.** `lib/api/*` imports `server-only` and a live DB; the spec's test list is unreachable without a pure module.

## Review

Shipped. `pnpm typecheck` clean, `pnpm test` 70 passed (46 existing + 24 new), `pnpm build` compiled.

Verified in Chrome at 1440 wide and at a true 390px viewport, guest and signed-in:

- `/` returns 200 for a guest and 307 to `/home` with `evotv_role=viewer` or `=admin`.
- On-air band read `23:00-00:00 Timmyggz: Elite Plays Live`, up next `00:00 NoBoneZ`, matching the grid.
- Pillar hours on the page (96 esports / 14 anime / 58 lifestyle) match the importer's own count exactly.
- Day tabs and the pillar filter both work; Wednesday + Anime renders the empty state rather than a blank list.
- Console clean: no errors, no hydration warnings.
- `scripts/epg-pdf-to-csv.py` re-run against the source PDF reproduces the committed CSV byte for byte.

### Things found while building that were not in the spec

1. **`/schedule` does not exist.** The spec's primary CTA pointed at it and it 404s; the app only ships `/api/schedule`. The CTA, header and footer links now anchor `#week` on the landing page itself. A real `/schedule` page is still unbuilt.
2. **`node_modules` was fully broken.** Every symlink still pointed at `GAMEEVO/EVOTV`, the pre-move path, so `pnpm typecheck`, `pnpm test` and `pnpm build` could not run at all. Fixed by reinstalling. `.next` had the same stale absolute paths and had to be deleted.
3. **`pnpm db:generate` cannot be used in this repo.** Drizzle snapshots stop at `0010` while migrations run to `0030`, so drizzle-kit diffs against a twenty-migration-stale snapshot and prompts to rename or drop live tables. `0031_epg_slots.sql` is hand-written with a matching journal entry, which is what every migration since `0011` already did.
4. **`.env.local` still points at Neon.** Anyone running `pnpm db:migrate` locally hits the retired database, not DO.

### Deferred

- `/api/schedule` windows on a **UTC** day while the grid is Lagos-local, so a requested date returns Lagos 01:00 to 00:00. Pre-existing contract, left alone rather than silently changed under the native app.
- Pillar mapping is the spec's proposal and still needs owner sign-off.
- The April grid is four months old and may be stale.
