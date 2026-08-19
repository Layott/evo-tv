import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";

import { db, schema } from "@/lib/db";

/**
 * Places on the platform, by name.
 *
 * Nobody types a path. The announcements form asked for "an in-app path
 * starting with /", which requires the operator to know the route table, has
 * no validation worth the name, and ships a dead link the day a route is
 * renamed. A destination is chosen from real things, and the path is composed
 * here, once, in code that moves when the routes move.
 *
 * Rule set by the owner, 19 August 2026: no slugs, paths or ids in any field a
 * person fills in, anywhere on the site or in the app.
 */

export type Destination =
  | { kind: "none" }
  | { kind: "page"; page: FixedPage }
  | { kind: "show"; id: string }
  | { kind: "stream"; id: string }
  | { kind: "video"; id: string }
  | { kind: "external"; url: string };

export type FixedPage =
  | "home"
  | "channel"
  | "schedule"
  | "shows"
  | "discover"
  | "events"
  | "shop"
  | "upgrade";

const FIXED_PATHS: Record<FixedPage, string> = {
  home: "/home",
  channel: "/channel",
  schedule: "/schedule",
  shows: "/shows",
  discover: "/discover",
  events: "/events",
  shop: "/shop",
  upgrade: "/upgrade",
};

export const FIXED_PAGE_LABELS: Record<FixedPage, string> = {
  home: "Home",
  channel: "The channel",
  schedule: "Schedule",
  shows: "Shows",
  discover: "Discover",
  events: "Events",
  shop: "Shop",
  upgrade: "Upgrade",
};

/**
 * The path a destination points at, or null for "just open the app".
 *
 * A show is addressed by slug because that is its public address; the slug is
 * looked up rather than typed. A row that has gone since the message was
 * written resolves to null instead of a link to nothing.
 */
export async function resolvePath(dest: Destination): Promise<string | null> {
  switch (dest.kind) {
    case "none":
      return null;
    case "external":
      return dest.url;
    case "page":
      return FIXED_PATHS[dest.page] ?? null;
    case "show": {
      const row = (
        await db
          .select({ slug: schema.shows.slug })
          .from(schema.shows)
          .where(eq(schema.shows.id, dest.id))
          .limit(1)
      )[0];
      return row?.slug ? `/shows/${row.slug}` : null;
    }
    case "stream":
      return `/stream/${dest.id}`;
    case "video": {
      const row = (
        await db
          .select({ slug: schema.vods.slug })
          .from(schema.vods)
          .where(eq(schema.vods.id, dest.id))
          .limit(1)
      )[0];
      return `/vod/${row?.slug || dest.id}`;
    }
  }
}

/** What to call it on screen, so a preview can say where it goes. */
export async function describeDestination(dest: Destination): Promise<string> {
  switch (dest.kind) {
    case "none":
      return "opens the app";
    case "external":
      return dest.url;
    case "page":
      return FIXED_PAGE_LABELS[dest.page] ?? dest.page;
    case "show": {
      const row = (
        await db
          .select({ title: schema.shows.title })
          .from(schema.shows)
          .where(eq(schema.shows.id, dest.id))
          .limit(1)
      )[0];
      return row?.title ?? "a show that no longer exists";
    }
    case "stream": {
      const row = (
        await db
          .select({ title: schema.streams.title })
          .from(schema.streams)
          .where(eq(schema.streams.id, dest.id))
          .limit(1)
      )[0];
      return row?.title ?? "a broadcast that no longer exists";
    }
    case "video": {
      const row = (
        await db
          .select({ title: schema.vods.title })
          .from(schema.vods)
          .where(eq(schema.vods.id, dest.id))
          .limit(1)
      )[0];
      return row?.title ?? "a video that no longer exists";
    }
  }
}

export interface PickableThing {
  id: string;
  label: string;
  /** A second line, so two shows with similar names are tellable apart. */
  detail?: string;
}

/**
 * Everything an operator can point a message at, in one call.
 *
 * Capped: a picker with two thousand entries is a search box with extra steps,
 * and the newest rows are the ones a message is about.
 */
export async function pickableDestinations(): Promise<{
  shows: PickableThing[];
  streams: PickableThing[];
  videos: PickableThing[];
}> {
  const [shows, streams, videos] = await Promise.all([
    db
      .select({
        id: schema.shows.id,
        label: schema.shows.title,
        detail: schema.shows.status,
      })
      .from(schema.shows)
      .where(isNull(schema.shows.deletedAt))
      .orderBy(desc(schema.shows.releasedAt))
      .limit(100),
    db
      .select({
        id: schema.streams.id,
        label: schema.streams.title,
        detail: schema.streams.streamerName,
      })
      .from(schema.streams)
      .where(isNull(schema.streams.deletedAt))
      .orderBy(desc(schema.streams.createdAt))
      .limit(50),
    db
      .select({
        id: schema.vods.id,
        label: schema.vods.title,
        detail: schema.vods.publishedAt,
      })
      .from(schema.vods)
      .where(and(isNull(schema.vods.deletedAt)))
      .orderBy(desc(schema.vods.publishedAt))
      .limit(100),
  ]);

  return {
    shows: shows.map((r) => ({ id: r.id, label: r.label, detail: r.detail ?? undefined })),
    streams: streams.map((r) => ({ id: r.id, label: r.label, detail: r.detail ?? undefined })),
    videos: videos.map((r) => ({
      id: r.id,
      label: r.label,
      detail: r.detail ? new Date(r.detail).toLocaleDateString() : undefined,
    })),
  };
}
