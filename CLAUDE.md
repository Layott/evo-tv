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
