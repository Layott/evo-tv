/**
 * Phase 3.2 backfill — populate publishers, channels, and channel_id FKs
 * for pre-multi-tenant data.
 *
 *   1. Create the EVO TV-owned publisher (`pub_evotv`).
 *   2. Create one channel per distinct `streams.streamer_name`. EVO-owned
 *      streamers (streamer_type=official) attach to pub_evotv. Creator
 *      streamers will get their own publisher row later — for now they
 *      also attach to pub_evotv with a note so they don't dangle.
 *   3. Populate `streams.channel_id`, `vods.channel_id`, `clips.channel_id`,
 *      `tips.channel_id`.
 *
 * Idempotent: re-running won't duplicate publishers/channels (slug uniqueness
 * + ON CONFLICT). Safe to run multiple times.
 *
 * Run: `pnpm tsx db/backfill-tenancy.ts`
 */

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, isNull, sql } from "drizzle-orm";

import * as schema from "./schema";

const DATABASE_URL =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("[backfill] No DB connection string in env.");
  process.exit(1);
}

// Named `client` because `sql` is already the drizzle-orm raw-SQL tag above.
const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

const EVOTV_PUBLISHER_ID = "pub_evotv";
const EVOTV_PUBLISHER_SLUG = "evotv";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "channel";
}

function channelIdFor(slug: string): string {
  return `ch_${slug.replace(/-/g, "_")}`;
}

async function ensureEvotvPublisher(): Promise<void> {
  console.log("[backfill] Ensuring EVO TV publisher row...");
  await db
    .insert(schema.publishers)
    .values({
      id: EVOTV_PUBLISHER_ID,
      slug: EVOTV_PUBLISHER_SLUG,
      name: "EVO TV",
      contactEmail: "ops@evotv.tv",
      country: "NG",
      kycState: "verified",
      payoutMethod: "manual",
      revenueSharePct: 100,
      isEvotvOwned: true,
    })
    .onConflictDoNothing({ target: schema.publishers.slug });
  console.log(`[backfill]   pub_evotv ✓`);
}

interface StreamerSeed {
  streamerName: string;
  streamerAvatarUrl: string;
  isOfficial: boolean;
  streamCount: number;
}

async function collectDistinctStreamers(): Promise<StreamerSeed[]> {
  const rows = await db
    .select({
      streamerName: schema.streams.streamerName,
      streamerAvatarUrl: schema.streams.streamerAvatarUrl,
      streamerType: schema.streams.streamerType,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.streams)
    .groupBy(
      schema.streams.streamerName,
      schema.streams.streamerAvatarUrl,
      schema.streams.streamerType,
    );

  return rows.map((r) => ({
    streamerName: r.streamerName,
    streamerAvatarUrl: r.streamerAvatarUrl,
    isOfficial: r.streamerType === "official",
    streamCount: r.count,
  }));
}

interface ChannelInsertResult {
  channelId: string;
  streamerName: string;
}

async function ensureChannels(
  streamers: StreamerSeed[],
): Promise<ChannelInsertResult[]> {
  console.log(`[backfill] Ensuring ${streamers.length} channels...`);
  const inserted: ChannelInsertResult[] = [];

  for (const s of streamers) {
    const slug = slugify(s.streamerName);
    const channelId = channelIdFor(slug);
    await db
      .insert(schema.channels)
      .values({
        id: channelId,
        publisherId: EVOTV_PUBLISHER_ID,
        slug,
        name: s.streamerName,
        description: s.isOfficial
          ? `${s.streamerName} — official EVO TV channel.`
          : `${s.streamerName} — creator channel.`,
        logoUrl: s.streamerAvatarUrl,
        category: "esports",
        isVerified: s.isOfficial,
        isEvotvOwned: s.isOfficial,
      })
      .onConflictDoNothing({ target: schema.channels.slug });
    inserted.push({ channelId, streamerName: s.streamerName });
    console.log(
      `[backfill]   ${channelId.padEnd(32)} ← "${s.streamerName}" (${s.streamCount} streams)`,
    );
  }
  return inserted;
}

async function backfillStreamChannelIds(
  channels: ChannelInsertResult[],
): Promise<void> {
  console.log("[backfill] Populating streams.channel_id...");
  for (const c of channels) {
    const updated = await db
      .update(schema.streams)
      .set({ channelId: c.channelId })
      .where(
        sql`${schema.streams.streamerName} = ${c.streamerName} AND ${schema.streams.channelId} IS NULL`,
      )
      .returning({ id: schema.streams.id });
    if (updated.length > 0) {
      console.log(
        `[backfill]   streams: ${updated.length} rows ← ${c.channelId}`,
      );
    }
  }
}

async function backfillVodChannelIds(): Promise<void> {
  console.log("[backfill] Populating vods.channel_id via parent stream...");
  // vods.channel_id ← streams.channel_id where vods.stream_id matches.
  await db.execute(sql`
    UPDATE vods v
    SET channel_id = s.channel_id
    FROM streams s
    WHERE v.stream_id = s.id
      AND v.channel_id IS NULL
      AND s.channel_id IS NOT NULL;
  `);
  const orphans = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.vods)
    .where(isNull(schema.vods.channelId));
  console.log(
    `[backfill]   vods backfilled. ${orphans[0]?.count ?? 0} orphans remain (vods without parent stream channel).`,
  );
}

async function backfillClipChannelIds(): Promise<void> {
  console.log("[backfill] Populating clips.channel_id via parent vod or stream...");
  await db.execute(sql`
    UPDATE clips c
    SET channel_id = COALESCE(v.channel_id, s.channel_id)
    FROM clips c2
    LEFT JOIN vods v ON v.id = c2.vod_id
    LEFT JOIN streams s ON s.id = c2.stream_id
    WHERE c.id = c2.id
      AND c.channel_id IS NULL
      AND COALESCE(v.channel_id, s.channel_id) IS NOT NULL;
  `);
  const orphans = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.clips)
    .where(isNull(schema.clips.channelId));
  console.log(`[backfill]   clips backfilled. ${orphans[0]?.count ?? 0} orphans remain.`);
}

async function backfillTipChannelIds(): Promise<void> {
  console.log("[backfill] Populating tips.channel_id via parent stream...");
  await db.execute(sql`
    UPDATE tips t
    SET channel_id = s.channel_id
    FROM streams s
    WHERE t.stream_id = s.id
      AND t.channel_id IS NULL
      AND s.channel_id IS NOT NULL;
  `);
  const orphans = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.tips)
    .where(isNull(schema.tips.channelId));
  console.log(
    `[backfill]   tips backfilled. ${orphans[0]?.count ?? 0} orphans remain (tips not bound to a stream — channel attribution left null).`,
  );
}

async function main() {
  console.log("=== Phase 3.2 tenancy backfill ===");
  await ensureEvotvPublisher();
  const streamers = await collectDistinctStreamers();
  if (streamers.length === 0) {
    console.log("[backfill] No streams in DB; nothing to do.");
    return;
  }
  const channels = await ensureChannels(streamers);
  await backfillStreamChannelIds(channels);
  await backfillVodChannelIds();
  await backfillClipChannelIds();
  await backfillTipChannelIds();
  console.log("=== Backfill complete ===");
}

main()
  .catch((err) => {
    console.error("[backfill] FAILED:", err);
    process.exitCode = 1;
  })
  // postgres-js holds an open socket, so without this the process never exits.
  .finally(() => client.end({ timeout: 5 }));
