# Handover: removing the mock layer and going live

Written 2026-08-11, during a launch push with roughly a day of runway. Covers
commits `4af2c8f` onward on `backend` `feat/digitalocean`.

**Still local. Nothing pushed, nothing deployed.**

---

## 1. The single most important fact

**The content tables are empty.** Removing the mock layer does not produce a
populated site; it produces an honest one. Of 83 tables, 34 had rows, and almost
all of the user-facing catalogue had none:

| Has rows | Empty |
|---|---|
| epg_slots 168, episodes 42*, seasons 9*, games 4, channels 5, user 5, parties 4, streams 1, orders 1, chat_messages 6, analytics_daily 13, watch_events 65 | events, teams, players, matches, vods, clips, products, notifications, follows, likes, polls, subscriptions, tips, rewards_drops, pickem_entries, prediction_picks, playout_media, ads |

\* the shows, seasons and episodes were fabricated and have since been deleted.

So the launch task is not "make the pages show data", it is **"make the admin
able to put data in, and make the pages read it"**. That loop now works.

## 2. Architecture: how the swap was done

Pages are `"use client"` driving TanStack Query, so they cannot import
`lib/api/*` - those modules pull in `server-only` and a live Postgres client.

`lib/client/*` is the browser-side layer. It calls the 196 existing `/api/*`
route handlers and returns exactly the shapes `lib/mock/*` returned, so swapping
a page is a one-line import change:

```diff
-import { listGames } from "@/lib/mock";
+import { listGames } from "@/lib/client";
```

| Module | Covers |
|---|---|
| `_fetch.ts` | `apiGet` / `apiList` / `apiSend` |
| `catalog.ts` | games, streams, VODs, clips, events, teams, players, products |
| `account.ts` | profile, follows, notifications, orders, subscription, search |
| `ads.ts` | ad serving plus impression and click telemetry |
| `live.ts` | chat, polls, tier ladder |
| `admin.ts` | the whole admin control surface |

**`apiGet` treats 401 exactly like 404 and returns null.** Every user-scoped
endpoint 401s for a guest, and a guest has no profile or notifications; throwing
would put an error boundary on every public page with a follow button. Mutations
via `apiSend` still throw, so the UI can prompt a sign-in.

Domains with no backend are deliberately **absent** from `lib/client`, so
importing one is a compile error rather than a silent empty screen.

## 3. Contract mismatches found by running the server, not by reading types

The signatures matched; the payloads did not. Each of these would have shipped
as a blank section:

- `/api/events/[id]` returns `{ event, matches }`, not the event.
- `/api/follows`, `/api/notifications`, `/api/orders`, `/api/subscriptions/me`,
  `/api/streams/[id]/chat`, `/api/streams/[id]/polls` all wrap their payload.
- `/api/reports` takes a `category` enum plus free-text `details`, not `reason`.
- `FollowTarget` is `team | player | streamer`. There is no `channel`.
- `Poll` has `isClosed`, not `status`.
- `/api/search` returns no users, and no endpoint searches users, so
  `searchUsers` returns empty rather than pretending.
- `/api/admin/teams`, `/api/admin/players` and `/api/admin/events` are
  **create-only**: they 405 on GET. Listing uses the public routes.

Routes widened to serve their pages: `/api/events/[id]` and `/api/teams/[id]`
now resolve a slug as well as an id, and the teams route 404s on a miss instead
of returning `null` with a 200.

## 4. Auth is real now

The app ran entirely on `MockAuthProvider`: signing in picked a fabricated
profile out of `lib/mock/users.ts` by role and kept it in localStorage. Better
Auth was already mounted at `/api/auth/[...all]` and nothing used it.

`components/providers/auth-provider.tsx` holds a real session. The profile comes
from `/api/users/me`, follows from `/api/follows`, and onboarding is a
per-account flag rather than a browser flag.

Proven against the running server: sign-up creates a row and returns a token,
sign-in with those credentials succeeds, `/api/users/me` returns that profile
behind an HttpOnly `evotv.session_token`, and a guest gets "Auth required".

- Login and signup pages call Better Auth.
- OAuth called `simulateSsoLogin`, which invented a profile without contacting a
  provider. It now hands off to Better Auth. **Discord was removed**:
  `lib/auth/index.ts` registers only Google and Apple, and only when their
  client id and secret are set, so a Discord button could never have worked.
- The dev `RoleSwitcher` is deleted. Roles come from the account.
- `evotv_role` is still written for `proxy.ts` page gating and is a **UX hint
  only**: every API route re-checks the session server-side.

## 5. The admin loop, proven end to end

This is what launch depends on. Verified by doing it:

1. Signed in as an admin account.
2. `POST /api/admin/streams` created a stream and returned a one-time stream key.
3. `PATCH /api/admin/streams/[id]` with `isLive: true` plus a Cloudflare `.m3u8`.
4. `GET /api/streams` as a **guest** returned it.
5. `/home` rendered it as the hero and under "Live now" with a LIVE badge.

All test data was deleted afterwards.

### The blocker this uncovered

**Nothing could take a stream live.** `isLive` was only ever set by the RTMP
`on-publish` callback. The plan is Cloudflare Stream as the origin, which never
calls back into this app, so an admin could paste a manifest and the stream
would never appear under "Live now". `isLive` is now accepted by
`PATCH /api/admin/streams/[id]`: going live stamps `startedAt`, ending stamps
`endedAt` and zeroes the viewer count.

## 6. Missing artwork no longer renders as a broken image

Admins will not always set a thumbnail, and `<img src="">` draws the browser's
broken-image glyph. `components/ui/media-image.tsx` falls back to a deterministic
gradient seeded from the item id, with initials. Adopted in the hero carousel,
live-now, recommendations and trending-clips. **Use it for any new thumbnail.**

## 6b. Admin surface: done and remaining

**Streams manager is real** (`9215d56`). It was pure local state seeded from
bundled arrays: creating a stream pushed an object into a React array and never
persisted; reloading undid everything. It now reads `/api/admin/streams` and
mutates through create, delete, regenerate-key and a live toggle, with games and
events fetched so the create form offers what actually exists.

Two bugs that surfaced there, worth knowing because the same shape will recur:

- **`AdminGuard` locked real admins out.** `role` is `"guest"` for the first
  paint of every load while the session resolves, and the guard denied on that.
  It now waits for `ready`. **Any component gating on `role` has this bug** -
  check `ready` first. Known remaining sites: `library/downloads`, `library`,
  `tips`, `embed`, `api-access/keys`.
- **A fabricated stream key was on display**, derived from the stream id. It
  looked real; pasting it into OBS would have failed. The server stores only a
  hash, so a key genuinely cannot be shown twice.

`scripts/promote-admin.ts` was still opening `./data/evo.db` with better-sqlite3
and silently did nothing against Postgres. Rewritten; it promotes and demotes.
**To make the first admin: sign up through the app, then run it.**

**Content manager is real** (`71e4ca1`). Games, teams, players and events come
from the database and creating one persists. Editing and deleting deliberately
report that they are unsupported: the admin catalogue routes are create-only,
and deleting a game that streams and matches point at is a destructive cascade
that should not be a button until it is designed.

Still on mock, in priority order: `ads-manager`, `overview`, `orders`,
`users-roles`, `moderation`, `polls-manager`, `billing`, `admin-settings`. Each
has routes and a `lib/client/admin.ts` helper already; the work is the same swap.

### The gating bug class, worth internalising

Three bugs, one shape: an access decision made before the thing it depends on
arrived.

- `proxy.ts` gated `/admin` on `evotv_role`, which the client writes only after
  the profile loads, so a fresh sign-in bounced back to the login page it had
  just used. It now gates on the Better-Auth session cookie.
- `AuthProvider` took `role` from `/api/users/me`, so `AdminGuard` sat on
  "Checking your access" for as long as that took, and forever if it failed.
  Better-Auth already puts `role` on the session user, so gating no longer waits
  on the profile.
- The premium gate on `library/downloads` would flash the paywall at a paying
  member.

**Anything new that branches on `role` must check `ready` first.**

### One more trap

A stale `next dev` process will happily serve a build from before your edits and
make a correct change look broken. If a page shows empty data while its endpoint
returns rows in the browser console, kill the dev server, delete `.next`, and
restart before debugging further. That cost real time here.

## 7. What is still on the mock layer

Two groups. The first is mechanical, the second is a product decision.

### Backed by an API, just not swapped yet

`rewards`, `watch-parties` (`/api/parties`), `predictions`, `fantasy`, `pickem`,
`tips`, `creators`, `api-keys`, `flags`, `notifications`, `admin` components.
Each has routes; each needs a `lib/client` module and an import swap, following
the same pattern.

### No backend at all: 14 domains

`ai-commentary`, `auto-clips`, `bots`, `calendar`, `captions`, `cast`,
`co-streams`, `commentary-tracks`, `downloads`, `forensic`, `lite-mode`,
`payment-methods`, `sso`, `ussd`.

These are UI shells from the 2026-04-27 feature-expansion pass. They have no
tables, no routes and no data. **They cannot be made real by swapping an
import.** For launch the options are: hide them behind a feature flag, or ship
them clearly labelled as not yet available. Leaving them on mock means shipping
invented data to real users.

## 8. Run it

```bash
pnpm dev                                   # localhost:3060
pnpm tsx scripts/purge-fake-originals.ts   # dry run; --apply to delete
pnpm tsx scripts/fix-channel-assets.ts     # dry run; --apply
```

`.env.local` points at **Neon**, the retired database. Anyone running a migration
locally hits Neon, not DigitalOcean.
