import "server-only";

import { redisClient } from "./bus";

/**
 * Who is watching, counted across every container.
 *
 * The live viewer count was a `Map` inside one route module. With two `api`
 * containers behind Caddy that map holds the viewers this process is serving
 * and nothing else, so a stream with sixty viewers reported thirty on one
 * container and thirty on the other, whichever wrote to the row last won, and
 * the number on screen halved or doubled as connections landed on different
 * containers. It also reset to zero on every deploy.
 *
 * A sorted set in Valkey fixes both. Member is a per-connection id, score is
 * the last time that connection was seen. Counting is "how many members were
 * seen inside the window", so a container that dies without running its
 * cleanup takes its viewers out of the count by ageing out rather than
 * stranding them at a number nobody can decrement.
 *
 * With no REDIS_URL this degrades to the same per-process map as before, which
 * is correct for local dev and for a single container.
 */

const KEY_PREFIX = "evo:presence:";

/**
 * How long a viewer counts for without being refreshed.
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

/** In-process fallback: streamId -> viewerId -> last seen (ms). */
const local = new Map<string, Map<string, number>>();

function localSet(topic: string): Map<string, number> {
  let set = local.get(topic);
  if (!set) {
    set = new Map();
    local.set(topic, set);
  }
  return set;
}

function localCount(topic: string, now: number): number {
  const set = localSet(topic);
  for (const [id, seen] of set) if (now - seen > STALE_MS) set.delete(id);
  if (set.size === 0) local.delete(topic);
  return set.size;
}

type Pipeline = ReturnType<NonNullable<ReturnType<typeof redisClient>>["pipeline"]>;

async function withRedis(
  topic: string,
  mutate: (p: Pipeline, key: string, now: number) => void,
): Promise<number | null> {
  const redis = redisClient();
  if (!redis) return null;
  const key = `${KEY_PREFIX}${topic}`;
  const now = Date.now();
  try {
    const pipeline = redis.pipeline();
    mutate(pipeline, key, now);
    // Drop everyone who has not been seen inside the window, then count what
    // is left. Trimming on every touch keeps the set from growing without an
    // extra sweep job.
    pipeline.zremrangebyscore(key, 0, now - STALE_MS);
    pipeline.zcard(key);
    // A stream nobody is watching should not leave a key behind forever.
    pipeline.pexpire(key, STALE_MS * 4);
    const res = await pipeline.exec();
    if (!res) return null;
    // zcard is the second from last reply; each reply is [err, value].
    const card = res[res.length - 2];
    if (!card || card[0]) return null;
    return Number(card[1] ?? 0);
  } catch (err) {
    console.error(
      "[presence] redis failed, falling back to this process:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/** Mark a viewer present. Returns the count across all containers. */
export async function join(topic: string, viewerId: string): Promise<number> {
  const viaRedis = await withRedis(topic, (p, key, now) => {
    p.zadd(key, now, viewerId);
  });
  if (viaRedis !== null) return viaRedis;
  const now = Date.now();
  localSet(topic).set(viewerId, now);
  return localCount(topic, now);
}

/** Keep a viewer present. Call on the SSE heartbeat. */
export async function refresh(topic: string, viewerId: string): Promise<number> {
  return join(topic, viewerId);
}

/** Drop a viewer immediately rather than waiting for them to age out. */
export async function leave(topic: string, viewerId: string): Promise<number> {
  const viaRedis = await withRedis(topic, (p, key) => {
    p.zrem(key, viewerId);
  });
  if (viaRedis !== null) return viaRedis;
  const now = Date.now();
  localSet(topic).delete(viewerId);
  return localCount(topic, now);
}

/** Current count without changing anything. */
export async function count(topic: string): Promise<number> {
  const viaRedis = await withRedis(topic, () => {});
  if (viaRedis !== null) return viaRedis;
  return localCount(topic, Date.now());
}

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
