/**
 * Seed script: reads lib/mock fixtures, upserts into Postgres.
 * Run with `pnpm db:seed`. Idempotent.
 */
import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import crypto from "node:crypto";

import * as schema from "./schema";

import { games } from "../lib/mock/games";
import { teams } from "../lib/mock/teams";
import { players } from "../lib/mock/players";
import { events, matches } from "../lib/mock/events";
import { streams } from "../lib/mock/streams";
import { vods, clips } from "../lib/mock/vods";
import { profiles as mockProfiles, userPrefs as mockPrefs } from "../lib/mock/users";
import { subscriptions as mockSubs } from "../lib/mock/subs";
import { products as mockProducts } from "../lib/mock/products";
import { orders as mockOrders } from "../lib/mock/orders";
import { ads as mockAds } from "../lib/mock/ads";
import { notifications as mockNotifs } from "../lib/mock/notifications";
import { polls as mockPolls } from "../lib/mock/polls";
import { follows as mockFollows } from "../lib/mock/follows";
import { featureFlags as mockFlags } from "../lib/mock/flags";

const DATABASE_URL =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[seed] No DB URL found (POSTGRES_URL_NON_POOLING / POSTGRES_URL / DATABASE_URL)");
  process.exit(1);
}
const sql = neon(DATABASE_URL);
const db = drizzle(sql, { schema });

const SECRET = process.env.AUTH_SECRET ?? "dev_stream_key_secret";
const hashKey = (key: string) =>
  crypto.createHmac("sha256", SECRET).update(key).digest("hex");

const nowIso = () => new Date().toISOString();

async function run() {
  console.log(`[seed] opening Neon Postgres`);

  // Better-Auth `user` table + app-owned `profiles` table.
  for (const p of mockProfiles) {
    await db.insert(schema.user)
      .values({
        id: p.id,
        name: p.displayName,
        email: `${p.handle}@evotv.local`,
        emailVerified: p.onboardedAt !== null,
        image: p.avatarUrl || null,
        role: p.role === "guest" ? "user" : p.role,
        handle: p.handle,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.createdAt),
      })
      .onConflictDoNothing();

    await db.insert(schema.profiles)
      .values({
        userId: p.id,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        bio: p.bio,
        country: p.country,
        onboardedAt: p.onboardedAt,
        createdAt: p.createdAt,
      })
      .onConflictDoNothing();
  }
  console.log(`[seed] users + profiles: ${mockProfiles.length}`);

  for (const [userId, prefs] of Object.entries(mockPrefs)) {
    await db.insert(schema.userPrefs)
      .values({
        userId,
        favoriteGames: prefs.favoriteGames,
        favoriteTeams: prefs.favoriteTeams,
        favoritePlayers: prefs.favoritePlayers,
        notifOptIn: prefs.notifOptIn,
        playback: prefs.playback,
        language: prefs.language,
        theme: prefs.theme,
      })
      .onConflictDoNothing();
  }

  for (const g of games)
    await db.insert(schema.games).values(g).onConflictDoNothing();
  console.log(`[seed] games: ${games.length}`);

  for (const t of teams)
    await db.insert(schema.teams).values(t).onConflictDoNothing();
  console.log(`[seed] teams: ${teams.length}`);

  for (const p of players)
    await db.insert(schema.players)
      .values({ ...p, kda: Math.round(p.kda * 100) })
      .onConflictDoNothing();
  console.log(`[seed] players: ${players.length}`);

  for (const e of events) {
    await db.insert(schema.events)
      .values({
        id: e.id,
        slug: e.slug,
        title: e.title,
        gameId: e.gameId,
        startsAt: e.startsAt,
        endsAt: e.endsAt,
        status: e.status,
        tier: e.tier,
        bannerUrl: e.bannerUrl,
        thumbnailUrl: e.thumbnailUrl,
        description: e.description,
        prizePoolNgn: e.prizePoolNgn,
        region: e.region,
        format: e.format,
        viewerCount: e.viewerCount ?? 0,
      })
      .onConflictDoNothing();
    for (const tid of e.teamIds) {
      await db.insert(schema.eventTeams)
        .values({ eventId: e.id, teamId: tid })
        .onConflictDoNothing();
    }
  }
  console.log(`[seed] events: ${events.length}`);

  for (const m of matches)
    await db.insert(schema.matches).values(m).onConflictDoNothing();
  console.log(`[seed] matches: ${matches.length}`);

  for (const s of streams) {
    const streamKey = `sk_live_${s.id.slice(-8)}`;
    await db.insert(schema.streams)
      .values({
        id: s.id,
        title: s.title,
        description: s.description,
        eventId: s.eventId,
        gameId: s.gameId,
        streamerType: s.streamerType,
        streamerName: s.streamerName,
        streamerAvatarUrl: s.streamerAvatarUrl,
        streamKeyHash: hashKey(streamKey),
        isLive: s.isLive,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        hlsPath: s.hlsUrl,
        thumbnailUrl: s.thumbnailUrl,
        viewerCount: s.viewerCount,
        peakViewerCount: s.peakViewerCount,
        language: s.language,
        tags: s.tags,
        isPremium: s.isPremium,
        createdAt: s.startedAt ?? nowIso(),
      })
      .onConflictDoNothing();
  }
  console.log(`[seed] streams: ${streams.length} (stream keys derived from id; dev only)`);

  const streamIds = new Set(streams.map((s) => s.id));
  for (const v of vods)
    await db.insert(schema.vods)
      .values({
        id: v.id,
        streamId: v.streamId && streamIds.has(v.streamId) ? v.streamId : null,
        title: v.title,
        description: v.description,
        gameId: v.gameId,
        durationSec: v.durationSec,
        hlsPath: v.hlsUrl,
        mp4Path: v.mp4Url,
        thumbnailUrl: v.thumbnailUrl,
        publishedAt: v.publishedAt,
        chapters: v.chapters,
        viewCount: v.viewCount,
        likeCount: v.likeCount,
        isPremium: v.isPremium,
      })
      .onConflictDoNothing();
  console.log(`[seed] vods: ${vods.length}`);

  const vodIds = new Set(vods.map((v) => v.id));
  for (const c of clips)
    await db.insert(schema.clips)
      .values({
        id: c.id,
        vodId: c.vodId && vodIds.has(c.vodId) ? c.vodId : null,
        streamId: c.streamId && streamIds.has(c.streamId) ? c.streamId : null,
        title: c.title,
        creatorHandle: c.creatorHandle,
        creatorAvatarUrl: c.creatorAvatarUrl,
        durationSec: c.durationSec,
        mp4Path: c.mp4Url,
        thumbnailUrl: c.thumbnailUrl,
        viewCount: c.viewCount,
        likeCount: c.likeCount,
        createdAt: c.createdAt,
        gameId: c.gameId,
      })
      .onConflictDoNothing();
  console.log(`[seed] clips: ${clips.length}`);

  for (const s of mockSubs)
    await db.insert(schema.subscriptions).values(s).onConflictDoNothing();
  console.log(`[seed] subscriptions: ${mockSubs.length}`);

  for (const p of mockProducts)
    await db.insert(schema.products).values(p).onConflictDoNothing();
  console.log(`[seed] products: ${mockProducts.length}`);

  for (const o of mockOrders)
    await db.insert(schema.orders).values(o).onConflictDoNothing();
  console.log(`[seed] orders: ${mockOrders.length}`);

  for (const a of mockAds)
    await db.insert(schema.ads).values(a).onConflictDoNothing();
  console.log(`[seed] ads: ${mockAds.length}`);

  for (const n of mockNotifs)
    await db.insert(schema.notifications).values(n).onConflictDoNothing();
  console.log(`[seed] notifications: ${mockNotifs.length}`);

  for (const p of mockPolls)
    await db.insert(schema.polls)
      .values({
        id: p.id,
        streamId: p.streamId,
        question: p.question,
        options: p.options,
        createdAt: p.createdAt,
        closesAt: p.closesAt,
        isClosed: p.isClosed,
        totalVotes: p.totalVotes,
      })
      .onConflictDoNothing();
  console.log(`[seed] polls: ${mockPolls.length}`);

  for (const f of mockFollows)
    await db.insert(schema.follows).values(f).onConflictDoNothing();
  console.log(`[seed] follows: ${mockFollows.length}`);

  for (const f of mockFlags)
    await db.insert(schema.featureFlags)
      .values({ key: f.key, enabled: f.enabled, description: f.description })
      .onConflictDoNothing();
  console.log(`[seed] feature flags: ${mockFlags.length}`);

  console.log("[seed] done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
