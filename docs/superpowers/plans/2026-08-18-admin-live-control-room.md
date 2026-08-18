# Admin Live Control Room Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give an operator a screen they can leave open during a broadcast that shows which accounts are watching right now and how the audience is moving.

**Architecture:** Two sources, each for what it is good at. A Valkey sorted set (`lib/sse/presence.ts`, currently dead code) answers "who is watching right now", written by the heartbeat endpoint that both clients already call. The `watch_events` table answers "what happened across the broadcast": the curve, the splits, and any broadcast that has already ended. Nothing new is opened, polled, or held.

**Tech Stack:** Next.js App Router, Drizzle ORM on Postgres 17, ioredis against Valkey, TanStack Query, Recharts 2.15.4, Tailwind, vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-admin-live-control-room-design.md`

## Global Constraints

- **No em dashes or en dashes anywhere.** Prose, code, comments, commit messages. Use a comma, colon, parentheses, or reword.
- **No npm.** Use `pnpm`. `pnpm test`, `pnpm typecheck`, `pnpm test:integration`.
- **No hairline borders.** No `border`, `border-t/b/l/r`, `1px solid`, `divide-x`, `divide-y`, `ring-1`, `ring-2`, `<hr>`, no dashed empty boxes. Build structure with filled surfaces (`bg-card`, `bg-card/50`) and spacing. The only exception is `:focus-visible`.
- **No glow or ambient animation.** No `animate-pulse`, no `animate-ping`, no `box-shadow: 0 0 ...`, no colored shadows, no blurred decorative orbs. The live dot is a solid flat dot.
- **Never commit or push to `main`.** All work lands on `feature/admin-live-control-room`, which is already cut from `dev`.
- **Migration number is 0044.** `0043_stream_reconnect_window.sql` already exists.
- **Presence stale window is 75 seconds**, read from `PRESENCE_STALE_MS` with 75000 as the default.
- **Heartbeat cadence stays 60 seconds.** Do not change it.
- **Roster reads are audited.** Every roster response writes an `audit_log` row.
- **All admin routes use `requireAdminFromRequest()`** from `@/lib/api/admin`, which returns `{ ok: false, response }` on failure.

---

## File Structure

**Create:**
- `db/migrations/0044_live_telemetry.sql` - three columns and one index on `watch_events`
- `lib/api/live-roster.ts` - who is watching right now, and their session facts
- `lib/api/live-stats.ts` - the curve, the splits, and the totals for a broadcast
- `app/api/admin/live/route.ts` - list of broadcasts currently live
- `app/api/admin/live/[streamId]/roster/route.ts`
- `app/api/admin/live/[streamId]/stats/route.ts`
- `app/api/sse/admin/live/[streamId]/route.ts` - the 5s push
- `app/(admin)/admin/live/page.tsx` - the route
- `components/admin/live-control-room.tsx` - picker, figures, curve, splits
- `components/admin/live-roster-table.tsx` - the roster and its per-row actions
- `tests/unit/live-stats.test.ts`
- `tests/integration/live-presence.test.ts`

**Modify:**
- `db/schema/multi_tenant.ts:172-191` - the three columns and the index
- `lib/sse/presence.ts:33` - configurable stale window, plus a `members()` reader
- `app/api/streams/[id]/heartbeat/route.ts` - write presence, capture device, country and rung
- `hooks/use-stream-heartbeat.ts` - send the rung
- `components/stream/video-player.tsx` - report the current hls.js level
- `lib/api/admin.ts:48` - widen `AuditAction` with `"view"`
- `lib/client/admin.ts` - three client functions and their types
- `components/shell/admin-nav.tsx` (or wherever the admin nav lives) - a link to `/admin/live`

---

### Task 1: Presence becomes real, and the heartbeat feeds it

The Valkey set exists and has never had a viewer in it. This task wires it to the heartbeat both clients already call, and adds the three columns the splits need.

**Files:**
- Create: `db/migrations/0044_live_telemetry.sql`
- Modify: `db/schema/multi_tenant.ts:172-191`
- Modify: `lib/sse/presence.ts:33`
- Modify: `app/api/streams/[id]/heartbeat/route.ts`
- Test: `tests/integration/live-presence.test.ts`

**Interfaces:**
- Consumes: `join`, `leave`, `count` from `@/lib/sse/presence` (already exported).
- Produces:
  - `members(topic: string): Promise<Array<{ key: string; seenAt: number }>>` from `@/lib/sse/presence`
  - `presenceTopic(streamId: string): string` from `@/lib/sse/presence`, returning `` `stream:${streamId}` ``
  - `watchEvents.country`, `watchEvents.device`, `watchEvents.rung`, all `text`, all nullable

- [ ] **Step 1: Write the failing integration test**

Create `tests/integration/live-presence.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The claim: presence and the SQL count never disagree.
 *
 * Two numbers for the same audience is worse than one slow number, because an
 * operator cannot tell which one is lying. This asserts they move together.
 *
 * Needs a broker:
 *
 *   docker run --rm -d -p 6399:6379 --name evo-test-valkey valkey/valkey:8-alpine
 *   REDIS_URL=redis://127.0.0.1:6399 pnpm test:integration
 *   docker rm -f evo-test-valkey
 */

const REDIS_URL = process.env.REDIS_URL;

type Presence = typeof import("@/lib/sse/presence");
type Bus = typeof import("@/lib/sse/bus");

async function load(): Promise<{ presence: Presence; bus: Bus }> {
  vi.resetModules();
  const bus = await import("@/lib/sse/bus");
  const presence = await import("@/lib/sse/presence");
  return { presence, bus };
}

describe.skipIf(!REDIS_URL)("live presence", () => {
  let mod: { presence: Presence; bus: Bus };
  const streamId = `test-${process.pid}-${process.hrtime.bigint()}`;
  let topic = "";

  beforeAll(async () => {
    mod = await load();
    topic = mod.presence.presenceTopic(streamId);
  });

  afterAll(async () => {
    await mod.presence.leave(topic, "user-a");
    await mod.presence.leave(topic, "user-b");
    await mod.bus.closeBus();
  });

  it("names the topic from the stream id", () => {
    expect(mod.presence.presenceTopic("abc")).toBe("stream:abc");
  });

  it("counts a joining viewer immediately", async () => {
    expect(await mod.presence.join(topic, "user-a")).toBe(1);
    expect(await mod.presence.join(topic, "user-b")).toBe(2);
  });

  it("counts the same viewer once however many times they beat", async () => {
    await mod.presence.join(topic, "user-a");
    await mod.presence.join(topic, "user-a");
    expect(await mod.presence.count(topic)).toBe(2);
  });

  it("drops a leaving viewer immediately", async () => {
    expect(await mod.presence.leave(topic, "user-b")).toBe(1);
  });

  it("lists who is present, so the roster has keys to look up", async () => {
    const list = await mod.presence.members(topic);
    expect(list.map((m) => m.key)).toEqual(["user-a"]);
    expect(list[0]!.seenAt).toBeGreaterThan(Date.now() - 10_000);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run:
```bash
docker run --rm -d -p 6399:6379 --name evo-test-valkey valkey/valkey:8-alpine
REDIS_URL=redis://127.0.0.1:6399 pnpm test:integration -- live-presence
```
Expected: FAIL, `presence.presenceTopic is not a function`.

- [ ] **Step 3: Add `presenceTopic`, `members`, and the configurable window**

In `lib/sse/presence.ts`, replace the `STALE_MS` constant (line 33) with:

```ts
/**
 * How long a connection counts for without being refreshed.
 *
 * The heartbeat beats every 60s, so this is one missed beat plus 15 seconds of
 * slack. It only governs the case where a viewer vanishes without telling us:
 * a killed tab, a force-quit app, a phone that lost signal. A clean arrival or
 * departure moves the count immediately, because the client calls POST on
 * mount and DELETE on unmount.
 *
 * Configurable so the window can be tightened without a deploy. Tightening it
 * below one beat interval would start dropping viewers who are still watching.
 */
const STALE_MS = Number(process.env.PRESENCE_STALE_MS ?? 75_000);
```

Then append to the same file:

```ts
/** The presence topic for one stream. One place, so callers cannot drift. */
export function presenceTopic(streamId: string): string {
  return `stream:${streamId}`;
}

/**
 * Who is present, with the time each was last seen.
 *
 * This is what makes a roster cheap. Without it the only way to ask "who is
 * watching" is a GROUP BY over watch_events, which for a three hour show with
 * a thousand viewers means grouping roughly 180,000 rows on every tick.
 */
export async function members(
  topic: string,
): Promise<Array<{ key: string; seenAt: number }>> {
  const redis = redisClient();
  const now = Date.now();
  if (!redis) {
    const set = localSet(topic);
    const out: Array<{ key: string; seenAt: number }> = [];
    for (const [key, seenAt] of set) {
      if (now - seenAt <= STALE_MS) out.push({ key, seenAt });
    }
    return out.sort((a, b) => b.seenAt - a.seenAt);
  }
  try {
    const raw = await redis.zrangebyscore(
      `${KEY_PREFIX}${topic}`,
      now - STALE_MS,
      "+inf",
      "WITHSCORES",
    );
    const out: Array<{ key: string; seenAt: number }> = [];
    for (let i = 0; i < raw.length; i += 2) {
      out.push({ key: raw[i]!, seenAt: Number(raw[i + 1]) });
    }
    return out.sort((a, b) => b.seenAt - a.seenAt);
  } catch (err) {
    console.error(
      "[presence] members failed:",
      err instanceof Error ? err.message : err,
    );
    return [];
  }
}
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `REDIS_URL=redis://127.0.0.1:6399 pnpm test:integration -- live-presence`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/sse/presence.ts tests/integration/live-presence.test.ts
git commit -m "Give presence a member list and a tunable window"
```

- [ ] **Step 6: Write the migration**

Create `db/migrations/0044_live_telemetry.sql`:

```sql
-- Live telemetry: the three cuts a live audience has and watch_events did not.
--
-- video_view_buckets has carried country and device for VOD since 0040. Live
-- had neither, so an operator could see how many were watching but never from
-- where or on what. rung is which quality the player actually pulled, which is
-- the number that says whether a 1080p rung would earn its bandwidth.
--
-- All nullable: every existing row predates the columns and is still valid.
ALTER TABLE "watch_events" ADD COLUMN IF NOT EXISTS "country" text;
ALTER TABLE "watch_events" ADD COLUMN IF NOT EXISTS "device" text;
ALTER TABLE "watch_events" ADD COLUMN IF NOT EXISTS "rung" text;

-- Every control room query is scoped to one stream. The existing index is
-- scoped to a channel, which does not serve them.
CREATE INDEX IF NOT EXISTS "watch_events_stream_bucket_idx"
  ON "watch_events" ("stream_id", "minute_bucket");
```

- [ ] **Step 7: Add the columns to the schema**

In `db/schema/multi_tenant.ts`, inside the `watchEvents` table definition, after `ipHash` (line 181):

```ts
    /** Two letter code from cf-ipcountry. Null on rows written before 0044. */
    country: text("country"),
    /** mobile / tablet / tv / desktop, from the user agent. */
    device: text("device"),
    /** Ladder rung the player pulled: _low, _mid, _hi. Website viewers only. */
    rung: text("rung"),
```

And add to the index list (line 188):

```ts
    index("watch_events_stream_bucket_idx").on(t.streamId, t.minuteBucket),
```

- [ ] **Step 8: Run the migration and typecheck**

Run:
```bash
pnpm db:migrate
pnpm typecheck
```
Expected: migration applies, typecheck clean.

- [ ] **Step 9: Wire the heartbeat to presence and record the new columns**

In `app/api/streams/[id]/heartbeat/route.ts`, add to the imports:

```ts
import { join, leave, presenceTopic } from "@/lib/sse/presence";
```

Add these helpers above `POST`, copied from `/api/watch/heartbeat` so the two derivations cannot drift apart:

```ts
/** Coarse enough to be a useful cut, coarse enough not to identify anybody. */
function deviceFrom(ua: string): string {
  const s = ua.toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|android|iphone/.test(s)) return "mobile";
  if (/smart-?tv|smarttv|appletv|googletv|hbbtv|netcast|webos|tizen/.test(s)) return "tv";
  if (!s) return "";
  return "desktop";
}

/** The ladder rung the player reported. Anything else is recorded as null. */
function rungFrom(value: unknown): string | null {
  return value === "_low" || value === "_mid" || value === "_hi" ? value : null;
}
```

In `POST`, after `const bucket = minuteBucket();`, add:

```ts
  // The viewer key is the same one liveViewerCounts() counts distinct on, so
  // the control room and the public page can never report different numbers.
  const viewerKey = user?.id ?? ipHash;
  const topic = presenceTopic(streamId);

  const country = (req.headers.get("cf-ipcountry") ?? "").slice(0, 2).toUpperCase();
  const device = deviceFrom(req.headers.get("user-agent") ?? "");
  let rung: string | null = null;
  try {
    const body = (await req.json()) as { rung?: unknown };
    rung = rungFrom(body?.rung);
  } catch {
    // The app sends no body at all. That is fine and must not fail the beat.
  }

  // Presence first, and on every beat rather than only on the first: it is one
  // ZADD, and it is what refreshes this viewer's score so they do not age out.
  await join(topic, viewerKey);
```

Change the insert to carry the new columns:

```ts
  await db.insert(schema.watchEvents).values({
    id: generateId(),
    channelId,
    streamId,
    userId: user?.id ?? null,
    minuteBucket: bucket,
    ipHash: user ? "" : ipHash,
    country: country === "XX" ? null : country || null,
    device: device || null,
    rung,
  });
```

The early return for a stream with no channel must still record presence, otherwise a viewer of an unbound stream is invisible. Replace that block with:

```ts
  if (!stream.channelId) {
    // Not bound to a channel, so there is no analytics row to write, but the
    // viewer is still watching and still belongs in the count.
    await join(presenceTopic(streamId), (await getCurrentUser())?.id ?? hashIp(req));
    return NextResponse.json({ ok: true, accounted: false });
  }
```

In `DELETE`, after resolving `user` and `ipHash`, add:

```ts
  // Drop them from the count now rather than making an operator wait out the
  // stale window for somebody who left politely.
  await leave(presenceTopic(streamId), user?.id ?? ipHash);
```

- [ ] **Step 10: Typecheck and run the full suite**

Run: `pnpm typecheck && pnpm test`
Expected: clean, no regressions.

- [ ] **Step 11: Prove the two counts agree**

This is the regression that matters most in the whole plan. Presence and `liveViewerCounts()` describe the same audience by two different routes, and two numbers that disagree are worse than one slow number, because an operator cannot tell which is lying.

Run `pnpm dev` with `REDIS_URL` set, open a live stream in a browser tab signed in, then:

```bash
psql "$DATABASE_URL" -c \
  "select count(distinct coalesce(user_id, ip_hash)) from watch_events
   where stream_id = '<streamId>'
     and created_at > now() - interval '90 seconds';"

redis-cli -u "$REDIS_URL" ZCOUNT "evo:presence:stream:<streamId>" \
  "$(( ($(date +%s) - 75) * 1000 ))" +inf
```

Expected: the same number. If they differ, the cause is almost always the viewer key: presence must be keyed on `user?.id ?? ipHash`, exactly what the SQL coalesces on. Fix the key, never the display.

Then close the tab and re-run both. Both should drop within a few seconds, not after 75.

- [ ] **Step 12: Commit**

```bash
git add db/migrations/0044_live_telemetry.sql db/schema/multi_tenant.ts app/api/streams/\[id\]/heartbeat/route.ts
git commit -m "Feed presence from the heartbeat, and record device, country and rung"
```

---

### Task 2: The roster query and its endpoint

**Files:**
- Create: `lib/api/live-roster.ts`
- Create: `app/api/admin/live/[streamId]/roster/route.ts`
- Modify: `lib/api/admin.ts:48`
- Test: `tests/integration/admin-endpoints.test.ts` (append)

**Interfaces:**
- Consumes: `members`, `presenceTopic` from `@/lib/sse/presence`; `requireAdminFromRequest`, `writeAudit` from `@/lib/api/admin`.
- Produces:
  ```ts
  export interface LiveRosterEntry {
    userId: string;
    name: string;
    avatarUrl: string | null;
    email: string;
    tier: "free" | "premium";
    joinedAt: string | null;      // ISO, first minute bucket this broadcast
    minutesWatched: number;
    device: string | null;
    country: string | null;
    rung: string | null;
    lastSeenAt: string;           // ISO
  }
  export interface LiveRoster {
    entries: LiveRosterEntry[];
    total: number;                // present accounts
    anonymous: number;            // present viewers with no account
  }
  export async function liveRoster(
    streamId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<LiveRoster>;
  ```

- [ ] **Step 1: Widen the audit action union**

In `lib/api/admin.ts`, line 48:

```ts
export type AuditAction = "create" | "update" | "delete" | "view";
```

Reading a roster is a privileged action, not a neutral one: it returns real names and real email addresses. "Who looked at the audience, and when" has to be answerable.

- [ ] **Step 2: Write the failing test**

Append to `tests/integration/admin-endpoints.test.ts`:

```ts
describe("live roster shape", () => {
  it("separates accounts it can name from viewers it cannot", async () => {
    const { splitPresent } = await import("@/lib/api/live-roster");
    const split = splitPresent([
      { key: "usr_1", seenAt: 1 },
      { key: "usr_2", seenAt: 2 },
      { key: "a1b2c3d4a1b2c3d4a1b2c3d4a1b2c3d4", seenAt: 3 },
    ]);
    expect(split.userIds).toEqual(["usr_1", "usr_2"]);
    expect(split.anonymous).toBe(1);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm test -- admin-endpoints`
Expected: FAIL, cannot resolve `@/lib/api/live-roster`.

- [ ] **Step 4: Write `lib/api/live-roster.ts`**

```ts
import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { members, presenceTopic } from "@/lib/sse/presence";

/**
 * Who is watching a broadcast right now.
 *
 * Presence answers "who", because it is a sorted set read rather than a GROUP
 * BY over the roughly 180,000 rows a three hour show with a thousand viewers
 * writes. watch_events then answers "since when, for how long, on what", but
 * only for the handful of viewers presence just named, so it stays bounded no
 * matter how long the broadcast has run.
 */

export interface LiveRosterEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  email: string;
  tier: "free" | "premium";
  joinedAt: string | null;
  minutesWatched: number;
  device: string | null;
  country: string | null;
  rung: string | null;
  lastSeenAt: string;
}

export interface LiveRoster {
  entries: LiveRosterEntry[];
  total: number;
  anonymous: number;
}

/**
 * A presence member is either an account id or a hashed ip.
 *
 * Anonymous viewers are counted and never listed, because there is nothing to
 * list: a hash is not a person an operator can act on. Account ids carry the
 * `usr_` prefix the id generator gives them; an ip hash is 32 hex characters.
 */
export function splitPresent(
  present: Array<{ key: string; seenAt: number }>,
): { userIds: string[]; anonymous: number } {
  const userIds: string[] = [];
  let anonymous = 0;
  for (const m of present) {
    if (/^[0-9a-f]{32}$/.test(m.key)) anonymous += 1;
    else userIds.push(m.key);
  }
  return { userIds, anonymous };
}

export async function liveRoster(
  streamId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<LiveRoster> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);

  const present = await members(presenceTopic(streamId));
  const { userIds, anonymous } = splitPresent(present);
  if (userIds.length === 0) {
    return { entries: [], total: 0, anonymous };
  }

  const seenAt = new Map(present.map((m) => [m.key, m.seenAt]));
  // Newest arrival first: during an incident the question is who just showed up.
  const page = userIds
    .sort((a, b) => (seenAt.get(b) ?? 0) - (seenAt.get(a) ?? 0))
    .slice(offset, offset + limit);

  const people = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      email: schema.user.email,
      image: schema.user.image,
    })
    .from(schema.user)
    .where(inArray(schema.user.id, page));

  const subs = await db
    .select({ userId: schema.subscriptions.userId, tier: schema.subscriptions.tier })
    .from(schema.subscriptions)
    .where(
      and(
        inArray(schema.subscriptions.userId, page),
        eq(schema.subscriptions.status, "active"),
      ),
    );
  const tierOf = new Map(subs.map((s) => [s.userId, s.tier]));

  // Bounded by the page, never by the length of the broadcast.
  const sessions = await db
    .select({
      userId: schema.watchEvents.userId,
      joinedAt: sql<string>`min(${schema.watchEvents.minuteBucket})`,
      minutes: sql<number>`count(*)::int`,
      device: sql<string | null>`(array_agg(${schema.watchEvents.device} ORDER BY ${schema.watchEvents.minuteBucket} DESC))[1]`,
      country: sql<string | null>`(array_agg(${schema.watchEvents.country} ORDER BY ${schema.watchEvents.minuteBucket} DESC))[1]`,
      rung: sql<string | null>`(array_agg(${schema.watchEvents.rung} ORDER BY ${schema.watchEvents.minuteBucket} DESC))[1]`,
    })
    .from(schema.watchEvents)
    .where(
      and(
        eq(schema.watchEvents.streamId, streamId),
        inArray(schema.watchEvents.userId, page),
      ),
    )
    .groupBy(schema.watchEvents.userId);
  const sessionOf = new Map(sessions.map((s) => [s.userId, s]));

  const byId = new Map(people.map((p) => [p.id, p]));
  const entries: LiveRosterEntry[] = page.flatMap((id) => {
    const person = byId.get(id);
    // A presence member with no account row is a deleted account still ageing
    // out of the set. Counted in total, not shown as a blank row.
    if (!person) return [];
    const session = sessionOf.get(id);
    return [
      {
        userId: id,
        name: person.name || person.email,
        avatarUrl: person.image ?? null,
        email: person.email,
        tier: (tierOf.get(id) ?? "free") as "free" | "premium",
        joinedAt: session?.joinedAt ?? null,
        minutesWatched: session?.minutes ?? 0,
        device: session?.device ?? null,
        country: session?.country ?? null,
        rung: session?.rung ?? null,
        lastSeenAt: new Date(seenAt.get(id) ?? Date.now()).toISOString(),
      },
    ];
  });

  return { entries, total: userIds.length, anonymous };
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `pnpm test -- admin-endpoints`
Expected: PASS.

- [ ] **Step 6: Write the route**

Create `app/api/admin/live/[streamId]/roster/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminFromRequest, writeAudit } from "@/lib/api/admin";
import { liveRoster } from "@/lib/api/live-roster";

/**
 * GET /api/admin/live/[streamId]/roster
 *
 * Named accounts watching right now. Audited on every read: this returns real
 * names and real email addresses, so who looked and when should be answerable.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const { streamId } = await params;
  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "100");
  const offset = Number(url.searchParams.get("offset") ?? "0");

  const roster = await liveRoster(streamId, {
    limit: Number.isFinite(limit) ? limit : 100,
    offset: Number.isFinite(offset) ? offset : 0,
  });

  await writeAudit({
    actorId: guard.user.id,
    action: "view",
    targetType: "stream",
    targetId: streamId,
    meta: { what: "live-roster", returned: roster.entries.length },
  });

  return NextResponse.json(roster);
}
```

- [ ] **Step 7: Verify the role gate, including moderator**

A moderator must not see the roster. Their job is chat, not the audience list, and this endpoint returns email addresses.

Signed out:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3060/api/admin/live/any-id/roster
```
Expected: `403`.

Then, as a moderator. Set a test account's role and sign in as it in a browser (Better-Auth caches the role in the session cookie, so an existing session will not pick this up, you must sign in again):

```bash
psql "$DATABASE_URL" -c "update \"user\" set role = 'moderator' where email = '<test account>';"
```

Open `/api/admin/live/any-id/roster` in that browser session.
Expected: `403 Admin required`.

Promote the same account to `admin`, sign in again, reload.
Expected: `200`, and an `audit_log` row exists:

```bash
psql "$DATABASE_URL" -c \
  "select actor_id, action, target_type, meta from audit_log
   where action = 'view' order by created_at desc limit 1;"
```
Expected: one row with `meta->>'what' = 'live-roster'`.

- [ ] **Step 8: Commit**

```bash
git add lib/api/live-roster.ts app/api/admin/live lib/api/admin.ts tests/integration/admin-endpoints.test.ts
git commit -m "Answer who is watching right now, and audit every time it is asked"
```

---

### Task 3: The stats query and its endpoint

**Files:**
- Create: `lib/api/live-stats.ts`
- Create: `app/api/admin/live/[streamId]/stats/route.ts`
- Test: `tests/unit/live-stats.test.ts`

**Interfaces:**
- Consumes: nothing from Task 2. Reads `watch_events` and `chat_messages` directly.
- Produces:
  ```ts
  export interface LiveCurvePoint {
    minute: string;   // ISO minute bucket
    viewers: number;
    joins: number;
    leaves: number;
    chatMessages: number;
  }
  export interface LiveSplit { label: string; viewers: number }
  export interface LiveStats {
    curve: LiveCurvePoint[];
    peak: number;
    current: number;
    joinsPerMinute: number;
    leavesPerMinute: number;
    avgWatchMinutes: number;
    byDevice: LiveSplit[];
    byCountry: LiveSplit[];
    byRung: LiveSplit[];
    rungCoverage: number;   // 0 to 1, share of viewers who reported a rung
  }
  export function buildCurve(
    rows: Array<{ minute: string; viewerKey: string }>,
    chat: Array<{ minute: string; n: number }>,
  ): LiveCurvePoint[];
  export async function liveStats(streamId: string): Promise<LiveStats>;
  ```

- [ ] **Step 1: Write the failing unit test**

Create `tests/unit/live-stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildCurve } from "@/lib/api/live-stats";

/**
 * Joins and leaves are derived, not recorded. A viewer whose first bucket is
 * this minute joined this minute; a viewer present last minute and absent this
 * minute left. Getting that wrong is the kind of bug nobody notices, because
 * the numbers still look plausible, so it is pinned by hand here.
 */
describe("buildCurve", () => {
  it("counts a viewer once per minute however many rows they wrote", () => {
    const curve = buildCurve(
      [
        { minute: "2026-08-18T10:00:00.000Z", viewerKey: "a" },
        { minute: "2026-08-18T10:00:00.000Z", viewerKey: "a" },
      ],
      [],
    );
    expect(curve).toHaveLength(1);
    expect(curve[0]!.viewers).toBe(1);
  });

  it("counts a first appearance as a join", () => {
    const curve = buildCurve(
      [
        { minute: "2026-08-18T10:00:00.000Z", viewerKey: "a" },
        { minute: "2026-08-18T10:01:00.000Z", viewerKey: "a" },
        { minute: "2026-08-18T10:01:00.000Z", viewerKey: "b" },
      ],
      [],
    );
    expect(curve.map((p) => p.joins)).toEqual([1, 1]);
  });

  it("counts a disappearance as a leave, in the minute they went", () => {
    const curve = buildCurve(
      [
        { minute: "2026-08-18T10:00:00.000Z", viewerKey: "a" },
        { minute: "2026-08-18T10:00:00.000Z", viewerKey: "b" },
        { minute: "2026-08-18T10:01:00.000Z", viewerKey: "a" },
      ],
      [],
    );
    expect(curve.map((p) => p.viewers)).toEqual([2, 1]);
    expect(curve.map((p) => p.leaves)).toEqual([0, 1]);
  });

  it("fills a minute nobody watched rather than closing the gap", () => {
    const curve = buildCurve(
      [
        { minute: "2026-08-18T10:00:00.000Z", viewerKey: "a" },
        { minute: "2026-08-18T10:02:00.000Z", viewerKey: "a" },
      ],
      [],
    );
    // A chart that closes the gap draws a flat line through an outage.
    expect(curve.map((p) => p.viewers)).toEqual([1, 0, 1]);
  });

  it("carries chat onto the same time axis", () => {
    const curve = buildCurve(
      [{ minute: "2026-08-18T10:00:00.000Z", viewerKey: "a" }],
      [{ minute: "2026-08-18T10:00:00.000Z", n: 7 }],
    );
    expect(curve[0]!.chatMessages).toBe(7);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm test -- live-stats`
Expected: FAIL, cannot resolve `@/lib/api/live-stats`.

- [ ] **Step 3: Write `lib/api/live-stats.ts`**

```ts
import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { count as presenceCount, presenceTopic } from "@/lib/sse/presence";

/**
 * What happened across a broadcast.
 *
 * Presence has no memory, so everything with a time axis comes from
 * watch_events. That is also why this screen works on a broadcast that ended
 * yesterday, which is when an operator usually wants to know what went wrong.
 */

export interface LiveCurvePoint {
  minute: string;
  viewers: number;
  joins: number;
  leaves: number;
  chatMessages: number;
}

export interface LiveSplit {
  label: string;
  viewers: number;
}

export interface LiveStats {
  curve: LiveCurvePoint[];
  peak: number;
  current: number;
  joinsPerMinute: number;
  leavesPerMinute: number;
  avgWatchMinutes: number;
  byDevice: LiveSplit[];
  byCountry: LiveSplit[];
  byRung: LiveSplit[];
  rungCoverage: number;
}

const MINUTE_MS = 60_000;

/**
 * Turn one row per viewer-minute into a curve with joins and leaves.
 *
 * Done in code rather than SQL because the window functions this needs are
 * harder to read than the loop, and the row count is bounded by the length of
 * the broadcast rather than by the size of the audience.
 */
export function buildCurve(
  rows: Array<{ minute: string; viewerKey: string }>,
  chat: Array<{ minute: string; n: number }>,
): LiveCurvePoint[] {
  if (rows.length === 0) return [];

  const perMinute = new Map<string, Set<string>>();
  for (const r of rows) {
    let set = perMinute.get(r.minute);
    if (!set) {
      set = new Set();
      perMinute.set(r.minute, set);
    }
    set.add(r.viewerKey);
  }

  const chatOf = new Map(chat.map((c) => [c.minute, c.n]));
  const stamps = [...perMinute.keys()].sort();
  const first = Date.parse(stamps[0]!);
  const last = Date.parse(stamps[stamps.length - 1]!);

  const out: LiveCurvePoint[] = [];
  let previous = new Set<string>();
  // Walk every minute, not only the ones with rows: a minute nobody watched is
  // a fact about the broadcast, and skipping it draws a flat line through an
  // outage.
  for (let t = first; t <= last; t += MINUTE_MS) {
    const minute = new Date(t).toISOString();
    const now = perMinute.get(minute) ?? new Set<string>();
    let joins = 0;
    for (const key of now) if (!previous.has(key)) joins += 1;
    let leaves = 0;
    for (const key of previous) if (!now.has(key)) leaves += 1;
    out.push({
      minute,
      viewers: now.size,
      joins,
      leaves,
      chatMessages: chatOf.get(minute) ?? 0,
    });
    previous = now;
  }
  return out;
}

function splitFrom(
  rows: Array<{ label: string | null; n: number }>,
  fallback: string,
): LiveSplit[] {
  return rows
    .map((r) => ({ label: r.label || fallback, viewers: Number(r.n) }))
    .sort((a, b) => b.viewers - a.viewers);
}

export async function liveStats(streamId: string): Promise<LiveStats> {
  const viewerKey = sql<string>`coalesce(${schema.watchEvents.userId}, ${schema.watchEvents.ipHash})`;

  const rows = await db
    .select({ minute: schema.watchEvents.minuteBucket, viewerKey })
    .from(schema.watchEvents)
    .where(eq(schema.watchEvents.streamId, streamId));

  const chat = await db
    .select({
      minute: sql<string>`to_char(date_trunc('minute', ${schema.chatMessages.createdAt}), 'YYYY-MM-DD"T"HH24:MI:00.000"Z"')`,
      n: sql<number>`count(*)::int`,
    })
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.streamId, streamId))
    .groupBy(sql`date_trunc('minute', ${schema.chatMessages.createdAt})`);

  const curve = buildCurve(rows, chat);

  // The last minute is still filling, so rates come from the one before it.
  const settled = curve.length >= 2 ? curve[curve.length - 2]! : curve[curve.length - 1];

  const distinct = new Set(rows.map((r) => r.viewerKey));
  const avgWatchMinutes = distinct.size === 0 ? 0 : rows.length / distinct.size;

  const [devices, countries, rungs] = await Promise.all([
    db
      .select({ label: schema.watchEvents.device, n: sql<number>`count(distinct ${viewerKey})::int` })
      .from(schema.watchEvents)
      .where(eq(schema.watchEvents.streamId, streamId))
      .groupBy(schema.watchEvents.device),
    db
      .select({ label: schema.watchEvents.country, n: sql<number>`count(distinct ${viewerKey})::int` })
      .from(schema.watchEvents)
      .where(eq(schema.watchEvents.streamId, streamId))
      .groupBy(schema.watchEvents.country),
    db
      .select({ label: schema.watchEvents.rung, n: sql<number>`count(distinct ${viewerKey})::int` })
      .from(schema.watchEvents)
      .where(and(eq(schema.watchEvents.streamId, streamId), sql`${schema.watchEvents.rung} is not null`))
      .groupBy(schema.watchEvents.rung),
  ]);

  const rungTotal = rungs.reduce((sum, r) => sum + Number(r.n), 0);

  return {
    curve,
    peak: curve.reduce((max, p) => Math.max(max, p.viewers), 0),
    current: await presenceCount(presenceTopic(streamId)),
    joinsPerMinute: settled?.joins ?? 0,
    leavesPerMinute: settled?.leaves ?? 0,
    avgWatchMinutes: Math.round(avgWatchMinutes * 10) / 10,
    byDevice: splitFrom(devices, "unknown"),
    byCountry: splitFrom(countries, "unknown"),
    byRung: splitFrom(rungs, "unknown"),
    // The app cannot report a rung on expo-video 2.0.0, so this is the share of
    // the audience the rung split actually describes. The page prints it rather
    // than presenting a website-only sample as the whole audience.
    rungCoverage: distinct.size === 0 ? 0 : rungTotal / distinct.size,
  };
}
```

- [ ] **Step 4: Confirm the chat table and column names**

Run:
```bash
grep -n "chatMessages = pgTable" -A 12 db/schema/*.ts
```
If the table is not called `chatMessages`, or its stream column is not `streamId`, or `createdAt` is stored as text rather than a timestamp, correct the two chat references in `liveStats` before running the test. A text `created_at` needs `date_trunc('minute', created_at::timestamptz)`.

- [ ] **Step 5: Run the test and watch it pass**

Run: `pnpm test -- live-stats`
Expected: PASS, 5 tests.

- [ ] **Step 6: Write the route**

Create `app/api/admin/live/[streamId]/stats/route.ts`:

```ts
import { NextResponse } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { liveStats } from "@/lib/api/live-stats";

/**
 * GET /api/admin/live/[streamId]/stats
 *
 * Aggregates only, so no audit row: this names nobody.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ streamId: string }> },
) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const { streamId } = await params;
  return NextResponse.json(await liveStats(streamId));
}
```

- [ ] **Step 7: Typecheck and commit**

```bash
pnpm typecheck
git add lib/api/live-stats.ts app/api/admin/live tests/unit/live-stats.test.ts
git commit -m "Build the audience curve, the splits and the rates for a broadcast"
```

---

### Task 4: The live list and the push

**Files:**
- Create: `app/api/admin/live/route.ts`
- Create: `app/api/sse/admin/live/[streamId]/route.ts`

**Interfaces:**
- Consumes: `liveStats` from `@/lib/api/live-stats`, `liveRoster` from `@/lib/api/live-roster`, `count`, `presenceTopic` from `@/lib/sse/presence`.
- Produces:
  ```ts
  export interface AdminLiveBroadcast {
    id: string;
    title: string;
    startedAt: string | null;
    viewers: number;
  }
  ```
  SSE events: `stats` carrying `LiveStats`, `roster` carrying `LiveRoster`.

- [ ] **Step 1: Write the list route**

Create `app/api/admin/live/route.ts`:

```ts
import { NextResponse } from "next/server";
import { eq, isNull, and } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { count, presenceTopic } from "@/lib/sse/presence";

/**
 * GET /api/admin/live
 *
 * Broadcasts on air right now, for the control room picker.
 */
export async function GET() {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const rows = await db
    .select({
      id: schema.streams.id,
      title: schema.streams.title,
      startedAt: schema.streams.startedAt,
    })
    .from(schema.streams)
    .where(and(eq(schema.streams.isLive, true), isNull(schema.streams.deletedAt)));

  const broadcasts = await Promise.all(
    rows.map(async (r) => ({ ...r, viewers: await count(presenceTopic(r.id)) })),
  );
  broadcasts.sort((a, b) => b.viewers - a.viewers);

  return NextResponse.json({ broadcasts });
}
```

If `schema.streams.deletedAt` is stored as text, `isNull` still works. If typecheck complains that `deletedAt` does not exist on `streams`, drop that clause rather than inventing a column.

- [ ] **Step 2: Write the SSE route**

Create `app/api/sse/admin/live/[streamId]/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { liveRoster } from "@/lib/api/live-roster";
import { liveStats } from "@/lib/api/live-stats";

/**
 * GET /api/sse/admin/live/[streamId]
 *
 * Pushes the control room instead of making it poll.
 *
 * Two cadences on purpose. The roster and the current count come from a sorted
 * set, so 5s is affordable and makes an arrival visible almost at once. The
 * stats are a scan over watch_events and their axis is per minute, so
 * recomputing them faster than every 30s would burn the database to redraw an
 * identical chart.
 */
const ROSTER_MS = 5_000;
const STATS_MS = 30_000;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const { streamId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      const pushRoster = async () => {
        try {
          send("roster", await liveRoster(streamId));
        } catch (err) {
          console.error("[admin-live] roster tick failed:", err);
        }
      };
      const pushStats = async () => {
        try {
          send("stats", await liveStats(streamId));
        } catch (err) {
          console.error("[admin-live] stats tick failed:", err);
        }
      };

      await pushRoster();
      await pushStats();

      const rosterTimer = setInterval(() => void pushRoster(), ROSTER_MS);
      const statsTimer = setInterval(() => void pushStats(), STATS_MS);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(rosterTimer);
        clearInterval(statsTimer);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

The roster tick writes no audit row. One row per open tab per five seconds would drown the log and answer nothing the tab's first read did not already answer.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/live/route.ts app/api/sse/admin/live
git commit -m "List what is on air, and push the control room instead of polling"
```

---

### Task 5: The page

**Files:**
- Create: `app/(admin)/admin/live/page.tsx`
- Create: `components/admin/live-control-room.tsx`
- Create: `components/admin/live-roster-table.tsx`
- Modify: `lib/client/admin.ts`
- Modify: the admin nav

**Interfaces:**
- Consumes: all three endpoints and the SSE route from Tasks 2, 3 and 4.
- Produces: `adminLiveBroadcasts()`, `adminLiveRoster(streamId)`, `adminLiveStats(streamId)` from `@/lib/client`.

- [ ] **Step 1: Add the client functions**

Append to `lib/client/admin.ts`, following the existing `apiGet` pattern:

```ts
/* ── Live control room ──────────────────────────────────────────────────── */

export interface AdminLiveBroadcast {
  id: string;
  title: string;
  startedAt: string | null;
  viewers: number;
}

export interface AdminLiveRosterEntry {
  userId: string;
  name: string;
  avatarUrl: string | null;
  email: string;
  tier: "free" | "premium";
  joinedAt: string | null;
  minutesWatched: number;
  device: string | null;
  country: string | null;
  rung: string | null;
  lastSeenAt: string;
}

export interface AdminLiveRoster {
  entries: AdminLiveRosterEntry[];
  total: number;
  anonymous: number;
}

export interface AdminLiveCurvePoint {
  minute: string;
  viewers: number;
  joins: number;
  leaves: number;
  chatMessages: number;
}

export interface AdminLiveSplit {
  label: string;
  viewers: number;
}

export interface AdminLiveStats {
  curve: AdminLiveCurvePoint[];
  peak: number;
  current: number;
  joinsPerMinute: number;
  leavesPerMinute: number;
  avgWatchMinutes: number;
  byDevice: AdminLiveSplit[];
  byCountry: AdminLiveSplit[];
  byRung: AdminLiveSplit[];
  rungCoverage: number;
}

export async function adminLiveBroadcasts(): Promise<AdminLiveBroadcast[]> {
  const res = await apiGet<{ broadcasts: AdminLiveBroadcast[] }>("/api/admin/live");
  return res?.broadcasts ?? [];
}

export async function adminLiveRoster(streamId: string): Promise<AdminLiveRoster | null> {
  return apiGet<AdminLiveRoster>(`/api/admin/live/${encodeURIComponent(streamId)}/roster`);
}

export async function adminLiveStats(streamId: string): Promise<AdminLiveStats | null> {
  return apiGet<AdminLiveStats>(`/api/admin/live/${encodeURIComponent(streamId)}/stats`);
}
```

Check how `apiGet` builds URLs before writing these: if it takes a params object rather than a path with an id embedded, follow that shape instead.

- [ ] **Step 2: Write the roster table**

Create `components/admin/live-roster-table.tsx`. Rules that are not negotiable: no `border`, no `divide-y`, no `ring-1`. Rows separate by zebra fill and padding. The live dot is solid with no `animate-pulse`.

```tsx
"use client";

import * as React from "react";
import type { AdminLiveRosterEntry } from "@/lib/client";
import { MediaImage } from "@/components/ui/media-image";
import { StatusBadge } from "./status-badge";
import { cn } from "@/lib/utils";

/**
 * Who is watching, newest arrival first.
 *
 * Zebra fill rather than row lines, per the platform's rule against building
 * structure out of hairlines.
 */
export function LiveRosterTable({
  entries,
  anonymous,
  onOpenUser,
  onTimeout,
  onBan,
}: {
  entries: AdminLiveRosterEntry[];
  anonymous: number;
  onOpenUser: (userId: string) => void;
  onTimeout: (userId: string) => void;
  onBan: (userId: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl bg-card/50 p-10 text-center text-sm text-muted-foreground">
        {anonymous > 0
          ? `Nobody signed in is watching yet. ${anonymous} viewer${anonymous === 1 ? "" : "s"} without an account.`
          : "Nobody is watching yet. Names appear here within a few seconds of somebody arriving."}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-card/50">
      {entries.map((e, i) => (
        <div
          key={e.userId}
          className={cn(
            "flex items-center gap-3 px-4 py-3",
            i % 2 === 1 && "bg-card/60",
          )}
        >
          <MediaImage
            src={e.avatarUrl ?? ""}
            alt=""
            className="size-9 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{e.name}</div>
            <div className="truncate text-xs text-muted-foreground">{e.email}</div>
          </div>
          <div className="hidden w-24 text-xs text-muted-foreground sm:block">
            {e.country ?? "unknown"} · {e.device ?? "unknown"}
          </div>
          <div className="w-20 text-right text-sm tabular-nums">
            {e.minutesWatched}m
          </div>
          <div className="w-20 text-right text-xs text-muted-foreground">
            {e.rung ? e.rung.replace("_", "") : "unknown"}
          </div>
          <StatusBadge tone={e.tier === "premium" ? "amber" : "neutral"}>
            {e.tier === "premium" ? "Premium" : "Free"}
          </StatusBadge>
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => onOpenUser(e.userId)}
              className="rounded-md bg-card px-2 py-1 text-xs hover:bg-muted"
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => onTimeout(e.userId)}
              className="rounded-md bg-card px-2 py-1 text-xs hover:bg-muted"
            >
              Timeout
            </button>
            <button
              type="button"
              onClick={() => onBan(e.userId)}
              className="rounded-md bg-card px-2 py-1 text-xs text-destructive hover:bg-muted"
            >
              Ban
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

Before writing the three action handlers, find the endpoints the moderation page already calls for timeout and ban (`components/admin/moderation-page.tsx`) and reuse them. Do not invent new moderation endpoints in this task. If no timeout endpoint exists, render the button disabled with a title saying so rather than wiring it to nothing.

- [ ] **Step 3: Write the control room**

Create `components/admin/live-control-room.tsx`:

```tsx
"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  adminLiveBroadcasts,
  adminLiveRoster,
  adminLiveStats,
  type AdminLiveRoster,
  type AdminLiveSplit,
  type AdminLiveStats,
} from "@/lib/client";
import { LiveRosterTable } from "./live-roster-table";
import { PageHeader } from "./page-header";
import { cn } from "@/lib/utils";

/**
 * What an operator watches while a show is on air.
 *
 * Pushed rather than polled: the server ticks the roster every 5s and the
 * stats every 30s. A dropped connection falls back to refetching and says so
 * on screen, because a frozen number that looks live is worse than a number
 * labelled stale.
 */

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-card/50 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Split({
  title,
  rows,
  note,
}: {
  title: string;
  rows: AdminLiveSplit[];
  note?: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.viewers, 0);
  return (
    <div className="rounded-xl bg-card/50 p-4">
      <div className="text-sm font-medium">{title}</div>
      {note ? (
        <div className="mt-1 text-xs text-muted-foreground">{note}</div>
      ) : null}
      {rows.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          Nothing recorded yet.
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.slice(0, 6).map((r) => (
            <div key={r.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{r.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {r.viewers}
                </span>
              </div>
              {/* Filled bar on a filled track. No outline, no stroke. */}
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${total === 0 ? 0 : (r.viewers / total) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LiveControlRoom() {
  const broadcastsQ = useQuery({
    queryKey: ["admin", "live", "broadcasts"],
    queryFn: adminLiveBroadcasts,
    refetchInterval: 30_000,
  });

  const broadcasts = broadcastsQ.data ?? [];
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Select the only broadcast on air without making somebody click it.
  React.useEffect(() => {
    if (selectedId && broadcasts.some((b) => b.id === selectedId)) return;
    setSelectedId(broadcasts[0]?.id ?? null);
  }, [broadcasts, selectedId]);

  const [stats, setStats] = React.useState<AdminLiveStats | null>(null);
  const [roster, setRoster] = React.useState<AdminLiveRoster | null>(null);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    if (!selectedId) return;
    setStats(null);
    setRoster(null);
    setConnected(false);
    if (typeof EventSource === "undefined") return;

    const source = new EventSource(`/api/sse/admin/live/${selectedId}`);
    source.addEventListener("open", () => setConnected(true));
    source.addEventListener("stats", (e) => {
      setConnected(true);
      setStats(JSON.parse((e as MessageEvent).data) as AdminLiveStats);
    });
    source.addEventListener("roster", (e) => {
      setConnected(true);
      setRoster(JSON.parse((e as MessageEvent).data) as AdminLiveRoster);
    });
    source.addEventListener("error", () => setConnected(false));
    return () => source.close();
  }, [selectedId]);

  // Only while the push is down. Reconnecting EventSource plus this would
  // double the load for no extra freshness.
  useQuery({
    queryKey: ["admin", "live", "fallback", selectedId],
    queryFn: async () => {
      if (!selectedId) return null;
      const [s, r] = await Promise.all([
        adminLiveStats(selectedId),
        adminLiveRoster(selectedId),
      ]);
      if (s) setStats(s);
      if (r) setRoster(r);
      return true;
    },
    enabled: !!selectedId && !connected,
    refetchInterval: 15_000,
  });

  if (broadcastsQ.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 rounded-lg bg-card/50" />
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-card/50" />
          ))}
        </div>
        <div className="h-64 rounded-xl bg-card/50" />
      </div>
    );
  }

  if (broadcastsQ.isError) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Could not load what is on air.{" "}
        <button
          type="button"
          className="underline"
          onClick={() => void broadcastsQ.refetch()}
        >
          Try again
        </button>
      </div>
    );
  }

  if (broadcasts.length === 0) {
    return (
      <>
        <PageHeader title="Live" description="Who is watching, while it happens." />
        <div className="py-16 text-center text-sm text-muted-foreground">
          Nothing is on air. This screen fills in when a broadcast starts.
        </div>
      </>
    );
  }

  const selected = broadcasts.find((b) => b.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader title="Live" description="Who is watching, while it happens." />

      {/* Filled chips. Selected is a stronger fill, never a ring. */}
      <div className="flex flex-wrap gap-2">
        {broadcasts.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setSelectedId(b.id)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              b.id === selectedId
                ? "bg-primary text-primary-foreground"
                : "bg-card text-foreground hover:bg-muted",
            )}
          >
            <span className="mr-2 inline-block size-2 rounded-full bg-red-500 align-middle" />
            {b.title}
            <span className="ml-2 tabular-nums opacity-70">{b.viewers}</span>
          </button>
        ))}
      </div>

      {!connected ? (
        <div className="rounded-xl bg-card/50 px-4 py-3 text-sm text-muted-foreground">
          Live updates disconnected. Refreshing every 15 seconds instead.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Figure label="Watching now" value={stats?.current ?? "-"} />
        <Figure label="Peak" value={stats?.peak ?? "-"} />
        <Figure label="Joining / min" value={stats?.joinsPerMinute ?? "-"} />
        <Figure label="Leaving / min" value={stats?.leavesPerMinute ?? "-"} />
        <Figure
          label="Avg watch"
          value={stats ? `${stats.avgWatchMinutes}m` : "-"}
        />
      </div>

      <div className="rounded-xl bg-card/50 p-4">
        <div className="mb-3 text-sm font-medium">Viewers across the broadcast</div>
        {!stats || stats.curve.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Nobody has watched this broadcast yet.
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.curve}>
                <XAxis
                  dataKey="minute"
                  tickFormatter={(v: string) =>
                    new Date(v).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={32} />
                <Tooltip
                  labelFormatter={(v) => new Date(v as string).toLocaleTimeString()}
                />
                <Area
                  type="monotone"
                  dataKey="viewers"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.18}
                />
                <Area
                  type="monotone"
                  dataKey="chatMessages"
                  stroke="var(--muted-foreground)"
                  fill="var(--muted-foreground)"
                  fillOpacity={0.08}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Split title="Device" rows={stats?.byDevice ?? []} />
        <Split title="Country" rows={stats?.byCountry ?? []} />
        <Split
          title="Quality"
          rows={stats?.byRung ?? []}
          note={`Website viewers only, ${Math.round((stats?.rungCoverage ?? 0) * 100)}% of the audience. The app cannot report quality on its current version.`}
        />
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">
            Watching now
            {roster ? (
              <span className="ml-2 text-muted-foreground">
                {roster.total} signed in
                {roster.anonymous > 0 ? `, ${roster.anonymous} without an account` : ""}
              </span>
            ) : null}
          </h2>
        </div>
        <LiveRosterTable
          entries={roster?.entries ?? []}
          anonymous={roster?.anonymous ?? 0}
          onOpenUser={(id) => window.open(`/admin/users?user=${id}`, "_blank")}
          onTimeout={() => {}}
          onBan={() => {}}
        />
      </div>

      {selected ? (
        <div className="rounded-xl bg-card/50 p-4">
          <div className="text-sm font-medium">End this broadcast</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Stops it for everybody watching. The encoder keeps running.
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

Two things to wire before this task is done, both by reusing what exists rather than inventing:

1. **`onTimeout` and `onBan`** are stubs above. Open `components/admin/moderation-page.tsx`, find the mutations it already uses for banning and timing out a user, and call those. If no timeout endpoint exists, render that button disabled with a `title` explaining why rather than wiring it to nothing.
2. **End broadcast** is a labelled panel above with no control. Import the `endBroadcast` mutation from `components/admin/streams-manager-page.tsx` (extract it into a shared hook if it is defined inline) and put its button in that panel. Do not write a second implementation.

Check `PageHeader`'s actual props before using it, and check whether `--primary` is the correct CSS variable name in this codebase's Tailwind 4 theme.

- [ ] **Step 4: Write the route**

Create `app/(admin)/admin/live/page.tsx`:

```tsx
import { AdminGuard } from "@/components/admin/admin-guard";
import { LiveControlRoom } from "@/components/admin/live-control-room";

export default function AdminLiveRoute() {
  return (
    <div className="p-6 lg:p-8">
      <AdminGuard>
        <LiveControlRoom />
      </AdminGuard>
    </div>
  );
}
```

- [ ] **Step 5: Add the nav link**

Find the admin navigation (`grep -rn "admin/streams" components/ --include=*.tsx | grep -i nav`) and add `Live` pointing at `/admin/live`, next to Streams.

- [ ] **Step 6: Grep for banned patterns**

Run:
```bash
grep -nE "border|divide-[xy]|ring-[12]|animate-pulse|animate-ping|<hr|shadow-\[0_0" \
  components/admin/live-control-room.tsx components/admin/live-roster-table.tsx
```
Expected: no output. Any hit must be replaced with a filled surface or spacing. `:focus-visible` rings are the only allowed exception.

- [ ] **Step 7: Verify in Chrome, desktop and mobile**

Both viewports are required, and `resize_window` does not resize a maximized window, so use the phone harness on 4747 for the mobile pass.

1. `pnpm dev`, sign in as an admin, open `/admin/live`.
2. With nothing on air, confirm the empty state reads as a sentence and there is no dashed box.
3. Start a broadcast, or set a stream `is_live` by hand, then open the public stream page in a second tab. Confirm your own account appears in the roster within about five seconds.
4. Close the viewer tab. Confirm the count drops within about five seconds, not after seventy five.
5. Read the console for errors and the network tab for 4xx or 5xx.
6. Screenshot both viewports.

- [ ] **Step 8: Commit**

```bash
git add app/\(admin\)/admin/live components/admin/live-control-room.tsx components/admin/live-roster-table.tsx lib/client/admin.ts
git commit -m "Add the live control room"
```

---

### Task 6: The website reports which rung it is playing

**Files:**
- Modify: `components/stream/video-player.tsx`
- Modify: `hooks/use-stream-heartbeat.ts`

**Interfaces:**
- Consumes: the `rung` field the heartbeat route already parses from Task 1.
- Produces: `useStreamHeartbeat(streamId, active, getRung?)` where `getRung` is `() => string | null`.

- [ ] **Step 1: Teach the hook to send a rung**

In `hooks/use-stream-heartbeat.ts`, change the signature and the POST:

```ts
export function useStreamHeartbeat(
  streamId: string | undefined,
  active: boolean,
  getRung?: () => string | null,
) {
```

and inside `beat()`:

```ts
      void fetch(`/api/streams/${streamId}/heartbeat`, {
        method: "POST",
        credentials: "include",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        // Read at beat time rather than captured once: a viewer on a train
        // moves between rungs during a broadcast, and the last rung they were
        // actually on is the useful one.
        body: JSON.stringify({ rung: getRung?.() ?? null }),
      }).catch(() => {
        // A missed beat costs one minute of attribution. Never surface it.
      });
```

`getRung` must not go in the effect's dependency array. It is called, never compared, and putting it there would tear down and rebuild the interval on every render.

- [ ] **Step 2: Report the level from the player**

In `components/stream/video-player.tsx`, the hls.js instance is already held in `hlsRef` (line 178) and the ladder is already read from `hls.levels` for the quality selector (line 100). Add:

```ts
  /**
   * Which ladder rung is actually playing.
   *
   * Mapped by height rather than by level index, because hls.js orders levels
   * by bitrate as the manifest lists them and the index means nothing on its
   * own. Heights come from the ladder in deploy/nginx-rtmp.conf: 360, 480, 720.
   */
  const getRung = React.useCallback((): string | null => {
    const hls = hlsRef.current;
    if (!hls) return null;
    const level = hls.levels[hls.currentLevel];
    if (!level) return null;
    if (level.height <= 400) return "_low";
    if (level.height <= 560) return "_mid";
    return "_hi";
  }, []);
```

Then pass it to the existing `useStreamHeartbeat` call in this file.

- [ ] **Step 3: Verify it lands**

1. `pnpm dev`, open a live stream on the website.
2. Watch the network tab: the heartbeat POST body should carry a rung.
3. Confirm in the database:
```bash
psql "$DATABASE_URL" -c "select rung, count(*) from watch_events where rung is not null group by rung;"
```
Expected: at least one row.
4. Force a rung with the quality selector and confirm the next beat reports the new one.

- [ ] **Step 4: Typecheck, test, commit**

```bash
pnpm typecheck && pnpm test
git add components/stream/video-player.tsx hooks/use-stream-heartbeat.ts
git commit -m "Report which ladder rung the website is playing"
```

---

### Task 7: Open the pull request

- [ ] **Step 1: Full check**

```bash
pnpm typecheck && pnpm test && pnpm lint
```

- [ ] **Step 2: Confirm the branch**

```bash
git rev-parse --abbrev-ref HEAD
```
Expected: `feature/admin-live-control-room`. Never `main`, never `dev`.

- [ ] **Step 3: Push and open the PR against `dev`**

```bash
git push -u origin feature/admin-live-control-room
gh pr create --base dev --title "Admin live control room" --body "..."
```

The body should say what an operator could not see before, name the finding that presence was dead code, and state plainly that the rung split covers website viewers only. Report the PR URL. Do not merge it.

---

## Notes for whoever executes this

- **Do not change the heartbeat cadence.** 60s is load-bearing: the presence window is derived from it, and halving it doubles requests without producing more rows, because inserts dedupe per minute bucket.
- **Do not revive `/api/sse/stream/[id]` for viewers.** Holding a socket per viewer on a two vCPU droplet costs real resources, and the heartbeat already provides everything the count needs.
- **If the control room and the public page ever disagree, that is a bug in this work, not a display difference.** Both count distinct `user_id ?? ip_hash`. Fix the source, do not paper over it in the UI.
- **Stale Turbopack builds** are a known trap in this repo: a route returning 405 with correct source means `rm -rf .next` and restart.
- **Better-Auth caches the role in the session cookie.** Promoting yourself to admin in the database does nothing to an open session. Sign out and back in.
