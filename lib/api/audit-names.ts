import "server-only";
import { inArray } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * What the thing an action was taken on is actually called.
 *
 * The log stored `ad_a0c8b70c397eeff5` and showed it, so reading it meant
 * copying an id into another screen to find out which ad, which show, or which
 * person. Names are resolved at read time rather than copied into the row at
 * write time, because a rename does not change what somebody did: the row says
 * what it was called when you look, and the id stays as the thing that cannot
 * drift.
 *
 * One query per type present in the page, not per row.
 */
export type NameMap = Record<string, string>;

/** Loaders keyed by the `target_type` the audit row carries. */
const LOADERS: Record<
  string,
  (ids: string[]) => Promise<Array<{ id: string; name: string }>>
> = {
  show: async (ids) =>
    (
      await db
        .select({ id: schema.shows.id, name: schema.shows.title })
        .from(schema.shows)
        .where(inArray(schema.shows.id, ids))
    ).map((r) => ({ id: r.id, name: r.name })),

  stream: async (ids) =>
    (
      await db
        .select({ id: schema.streams.id, name: schema.streams.title })
        .from(schema.streams)
        .where(inArray(schema.streams.id, ids))
    ).map((r) => ({ id: r.id, name: r.name })),

  vod: async (ids) =>
    (
      await db
        .select({ id: schema.vods.id, name: schema.vods.title })
        .from(schema.vods)
        .where(inArray(schema.vods.id, ids))
    ).map((r) => ({ id: r.id, name: r.name })),

  clip: async (ids) =>
    (
      await db
        .select({ id: schema.clips.id, name: schema.clips.title })
        .from(schema.clips)
        .where(inArray(schema.clips.id, ids))
    ).map((r) => ({ id: r.id, name: r.name })),

  episode: async (ids) =>
    (
      await db
        .select({
          id: schema.episodes.id,
          name: schema.episodes.title,
          season: schema.episodes.seasonNumber,
          episode: schema.episodes.episodeNumber,
        })
        .from(schema.episodes)
        .where(inArray(schema.episodes.id, ids))
    ).map((r) => ({ id: r.id, name: `S${r.season} E${r.episode} ${r.name}` })),

  user: async (ids) =>
    (
      await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
        })
        .from(schema.user)
        .where(inArray(schema.user.id, ids))
    ).map((r) => ({ id: r.id, name: r.name || r.email })),

  ad: async (ids) =>
    (
      await db
        .select({
          id: schema.ads.id,
          advertiser: schema.ads.advertiser,
          placement: schema.ads.placement,
        })
        .from(schema.ads)
        .where(inArray(schema.ads.id, ids))
    ).map((r) => ({ id: r.id, name: `${r.advertiser} · ${r.placement}` })),

  game: async (ids) =>
    (
      await db
        .select({ id: schema.games.id, name: schema.games.name })
        .from(schema.games)
        .where(inArray(schema.games.id, ids))
    ).map((r) => ({ id: r.id, name: r.name })),

  event: async (ids) =>
    (
      await db
        .select({ id: schema.events.id, name: schema.events.title })
        .from(schema.events)
        .where(inArray(schema.events.id, ids))
    ).map((r) => ({ id: r.id, name: r.name })),

  product: async (ids) =>
    (
      await db
        .select({ id: schema.products.id, name: schema.products.name })
        .from(schema.products)
        .where(inArray(schema.products.id, ids))
    ).map((r) => ({ id: r.id, name: r.name })),
};

/**
 * Names for every row in one page of the log.
 *
 * A type with no loader, or an id that no longer exists, is simply absent: the
 * screen falls back to the id, which is honest about a record that has been
 * deleted since.
 */
export async function resolveTargetNames(
  rows: Array<{ targetType: string; targetId: string }>,
): Promise<NameMap> {
  const byType = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!LOADERS[row.targetType]) continue;
    const set = byType.get(row.targetType) ?? new Set<string>();
    set.add(row.targetId);
    byType.set(row.targetType, set);
  }

  const out: NameMap = {};
  await Promise.all(
    Array.from(byType.entries()).map(async ([type, ids]) => {
      try {
        const found = await LOADERS[type]!(Array.from(ids));
        for (const item of found) out[`${type}:${item.id}`] = item.name;
      } catch {
        // One unreadable table must not blank out every other name on the page.
      }
    }),
  );
  return out;
}
