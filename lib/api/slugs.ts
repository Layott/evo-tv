import "server-only";
import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { slugSuffix, uniqueSlug } from "@/lib/slug";

/**
 * Slugs for the tables that get them at write time.
 *
 * Rows are given a slug when they are created rather than backfilled later,
 * which is the whole point: a row that is born with its slug never needs a
 * redirect from an id URL, because no id URL was ever published for it.
 *
 * The uniqueness check here is advisory. The unique index on the column is what
 * actually enforces it, and two concurrent inserts of the same title will still
 * race; the loser gets a constraint violation rather than a duplicate URL,
 * which is the correct outcome.
 */

type SluggedTable =
  | typeof schema.streams
  | typeof schema.vods
  | typeof schema.clips
  | typeof schema.shows;

async function isTaken(table: SluggedTable, candidate: string): Promise<boolean> {
  const hit = (
    await db.select({ id: table.id }).from(table).where(eq(table.slug, candidate)).limit(1)
  )[0];
  return Boolean(hit);
}

export async function slugForStream(title: string): Promise<string> {
  return uniqueSlug(title, (c) => isTaken(schema.streams, c), slugSuffix);
}

export async function slugForVod(title: string): Promise<string> {
  return uniqueSlug(title, (c) => isTaken(schema.vods, c), slugSuffix);
}

export async function slugForClip(title: string): Promise<string> {
  return uniqueSlug(title, (c) => isTaken(schema.clips, c), slugSuffix);
}

/**
 * A show's slug, always derived from its title.
 *
 * The CMS used to offer a slug field beside the name. It does not any more:
 * two places to say what a show is called is two chances to disagree, and the
 * URL is the one that ends up wrong. `exceptShowId` is for a rename, where the
 * row being renamed must not count as the thing blocking its own new slug.
 */
export async function slugForShow(
  title: string,
  exceptShowId?: string,
): Promise<string> {
  return uniqueSlug(
    title,
    (c) => showSlugTaken(c, exceptShowId),
    slugSuffix,
  );
}

/** Whether a slug an editor typed is already on another show. */
export async function showSlugTaken(
  candidate: string,
  exceptShowId?: string,
): Promise<boolean> {
  const hit = (
    await db
      .select({ id: schema.shows.id })
      .from(schema.shows)
      .where(eq(schema.shows.slug, candidate))
      .limit(1)
  )[0];
  if (!hit) return false;
  return hit.id !== exceptShowId;
}
