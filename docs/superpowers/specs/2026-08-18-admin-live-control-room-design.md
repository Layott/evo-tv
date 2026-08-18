# Admin live control room

Design, 2026-08-18.

An operator running a broadcast can currently see one number: `viewerCount` on
the stream row, printed in a side sheet, refreshed whenever the admin list
happens to refetch. They cannot see who is watching, whether the audience is
growing or draining, where it is watching from, or what it is watching on.

This adds `/admin/live`: a screen to leave open on a second monitor while a show
is on air.

## What already exists

Three systems are already in place and two of them are already doing most of the
work.

**`watch_events`** (`db/schema/multi_tenant.ts:172`) is an append-only log, one
row per viewer per minute, written by `POST /api/streams/[id]/heartbeat`. It
carries `user_id`, `stream_id`, `channel_id` and `minute_bucket`. Both surfaces
write it: the website through `hooks/use-stream-heartbeat.ts` and the app
through `lib/api/streams.ts`. Retention is 90 days.

Since watching started requiring an account on 2026-08-18, `user_id` is
populated for effectively every row. The identity needed for a roster is
already on disk.

**`liveViewerCounts()`** (`lib/api/streams.ts:17`) reads that table over a 90
second window and returns `count(distinct coalesce(user_id, ip_hash))` per
stream. It is the number on the public page. It throws the identity away.

**`lib/sse/presence.ts`** is a Valkey sorted set built to hold live viewers
across containers, with `join`, `leave`, `refresh` and `count`. **Nothing uses
it.** Its only caller is `/api/sse/stream/[id]`, and no client anywhere opens
that route: the website's stream page uses the heartbeat hook, and the app's
`useStreamChat` opens the chat SSE only. The module and its route are dead
code today.

## How fast the count already is, and where the lag really is

The heartbeat hook beats immediately on mount and sends a `DELETE` on unmount
with `keepalive`, and the app does the same. So:

- a viewer arriving moves the number immediately
- a viewer leaving cleanly moves the number immediately
- a viewer who crashes, loses signal, or force-quits the app never sends the
  `DELETE`, and has to age out of the 90 second read window

Only the third case is slow. It is worth fixing because it is the case that
happens most during a live show on mobile data, and because it always
overcounts, which is the direction that flatters and therefore misleads.

## Architecture: two sources, each for what it is good at

**Valkey presence answers "right now".** The heartbeat starts writing to it:
`POST` calls `join(topic, viewerKey)`, `DELETE` calls `leave(topic, viewerKey)`.
That is one `ZADD` and one `ZREM` against a Valkey instance that is already
provisioned and already paid for, on requests that are already being made. No
new client code, no new connections, no held sockets.

`viewerKey` is `user_id ?? ip_hash`, the same key `liveViewerCounts()` counts
distinct on, so the control room and the public page cannot disagree.

This is not only faster, it is cheaper than reading the table: the roster
becomes one `ZRANGEBYSCORE` instead of a `GROUP BY` over the ~180,000 rows a
three hour show with a thousand viewers produces.

`STALE_MS` drops from 90s to **75s** and becomes a config value, so the crash
window can be tightened later without a code change. Going below that means
beating more often than 60s, which multiplies HTTP requests without reducing
rows (inserts already dedupe per minute bucket). Not worth it yet.

**`watch_events` answers "what happened".** A sorted set has no memory, so
every curve, every split, every total, and every broadcast that has already
ended comes from the table. This is also why the table stays the source of
truth for anything an operator might later argue about.

### Known limitation, carried forward deliberately

A viewer watching on two devices counts once, and closing one device removes
them from the count entirely. This is exactly how the system behaves today:
the `DELETE` endpoint already deletes by `user_id` across the window, and
`liveViewerCounts()` already counts distinct viewers rather than distinct
sessions. Changing it means sending a per-session id from both clients. Noted,
not built, because consistency with the public number matters more than the
edge case.

## Schema: migration 0044

Three nullable columns on `watch_events`, so existing rows stay valid:

| Column | Why |
|---|---|
| `country` | Two letter code from `cf-ipcountry`. Live has no geography today; `video_view_buckets` already does this for VOD, and the derivation is copied from `/api/watch/heartbeat`. |
| `device` | `mobile` / `tablet` / `tv` / `desktop`, same UA derivation as VOD. |
| `rung` | Which ladder rung the player is pulling: `_low`, `_mid`, `_hi`. Website viewers only, see below. |

### `rung` is web only, and the page says so

The quality ladder shipped on 2026-08-18 and nothing records which rung the
audience actually sits on. That is the number that decides whether 1080p behind
Premium earns its bandwidth, so it is worth collecting even partially.

The website can report it. It plays through hls.js and already reads
`hls.levels` for its quality selector, so the current level is available for
about five lines of work.

The app cannot. It runs `expo-video ~2.0.0` on Expo SDK 52, which has no
video-track API. That arrived in a later expo-video, so app coverage means an
Expo SDK bump, which is its own piece of work and not part of this.

So the column is populated for website viewers and left null for the app, and
**the split is labelled as covering website viewers only**. An unlabelled
partial split would be a lie about the audience. A labelled one is a real
sample. The app starts filling it in by itself the day expo-video is upgraded,
with no schema change and no migration.

If the website sample later looks unrepresentative, the way to get full
coverage without an SDK bump is parsing nginx access logs for which variant
playlist each viewer pulls. That has no account to join against and means
shipping a log reader, so it is noted rather than planned.

### Index

One index: `(stream_id, minute_bucket)`. The existing index is channel scoped
and every query on this screen is stream scoped.

## Endpoints

All three require admin, through `requireAdminFromRequest()`. Only the roster
writes an audit row, because only the roster names anybody.

| Route | Returns |
|---|---|
| `GET /api/admin/live` | Every broadcast currently live, with its concurrent count. Feeds the picker. |
| `GET /api/admin/live/[streamId]/roster` | Accounts watching now, from Valkey. Name, avatar, email, tier, joined at, minutes watched, device, country, rung. Paginated, newest arrival first. |
| `GET /api/admin/live/[streamId]/stats` | From `watch_events`: concurrent curve per minute across the whole broadcast, peak, joins and leaves per minute, average watch duration, device / country / rung splits, chat messages per minute. |

### Why the roster is audited

It returns real names and real email addresses. The platform has an audit log,
and "who looked at the audience list, and when" should be answerable. Reading
is a privileged action here, not a neutral one.

## Real time

New `GET /api/sse/admin/live/[streamId]`, built on `lib/sse/bus.ts`, which
already has Valkey pub/sub and an `sseStream` helper.

The server recomputes on a **5 second** tick and pushes. Five seconds is
affordable because the "right now" half is a sorted set read, not a table scan.
The stats half is recomputed less often, on a 30 second tick, because a
per-minute curve cannot move faster than once a minute anyway.

The page never polls. If the SSE drops, it falls back to a refetch and says so
rather than quietly freezing on a stale number.

## The page

`/admin/live`, guarded by `AdminGuard` like every other admin route.

- **Picker**: broadcasts currently live, each with its concurrent count. A
  single live broadcast selects itself.
- **Figures**: current, peak, joins per minute, leaves per minute, average
  watch time. Plain numbers, tabular figures.
- **Curve**: concurrent viewers across the whole broadcast, ticking.
- **Splits**: device, country, rung.
- **Chat rate**: messages per minute against the same time axis, so an operator
  can see the audience react.
- **Roster**: table of accounts watching now, with per-row timeout, ban, and
  open user record.
- **End broadcast**, because that is the control an operator reaches for when
  something is wrong, and it should be on the screen they are already looking
  at.

### Design constraints

Filled surfaces and spacing only. No hairlines, no dividers, no outlined cards,
no rings on the filter chips. The live indicator is a solid dot with no pulse
and no glow. Real empty states in words, a real loading state, and a real error
path on every panel, including the case where a broadcast has no viewers yet.

## Explicitly not in scope

- **Per-viewer playback health** (buffering, errors, dropped frames). There is
  no player telemetry channel and inventing one is its own piece of work. The
  panel says so in words rather than showing an empty chart.
- **Signed-out viewers as named rows.** Watching requires an account. Anonymous
  rows are counted, never listed, because there is nothing to list.
- **Second-accurate concurrency.** The curve stays per minute. A chart that
  moves faster than the audience does is noise.
- **Reviving `/api/sse/stream/[id]` as a viewer-facing route.** Holding a socket
  open per viewer on a two vCPU droplet costs real resources, and the heartbeat
  already provides everything the count needs.

## Testing

- Presence: `join` / `leave` through the real heartbeat endpoints against a real
  Valkey, asserting the count moves immediately on both, and that a viewer who
  stops beating ages out at the configured window and not before.
- Agreement: the control room count and `liveViewerCounts()` must return the
  same number for the same stream at the same moment. This is the regression
  that matters, because two numbers that disagree are worse than one slow one.
- Stats: a seeded broadcast with a known join and leave pattern, asserting the
  curve, peak, joins, leaves and average watch time match the seed by hand.
- Role: `moderator` gets 403 on all three routes, `admin` gets 200, and the
  audit row exists afterwards.
- Browser walk on desktop and at 390x844 through `phone-harness.mjs`, since
  `resize_window` does not resize a maximized window.

## Order of work

1. Migration and the presence wiring, since every other piece reads them.
2. Endpoints, with the role and audit tests.
3. The page.
4. `rung` reporting on the website.
