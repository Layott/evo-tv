/**
 * Seed script: reads lib/mock fixtures, upserts into SQLite.
 * Run with `pnpm db:seed`. Idempotent.
 */
import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
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

const DB_PATH = process.env.DATABASE_URL ?? "./data/evo.db";
fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

const SECRET = process.env.AUTH_SECRET ?? "dev_stream_key_secret";
const hashKey = (key: string) =>
  crypto.createHmac("sha256", SECRET).update(key).digest("hex");

const nowIso = () => new Date().toISOString();

async function run() {
  console.log(`[seed] opening ${DB_PATH}`);

  // Better-Auth `user` table + app-owned `profiles` table.
  for (const p of mockProfiles) {
    db.insert(schema.user)
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
      .onConflictDoNothing()
      .run();

    db.insert(schema.profiles)
      .values({
        userId: p.id,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        bio: p.bio,
        country: p.country,
        onboardedAt: p.onboardedAt,
        createdAt: p.createdAt,
      })
      .onConflictDoNothing()
      .run();
  }
  console.log(`[seed] users + profiles: ${mockProfiles.length}`);

  for (const [userId, prefs] of Object.entries(mockPrefs)) {
    db.insert(schema.userPrefs)
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
      .onConflictDoNothing()
      .run();
  }

  for (const g of games)
    db.insert(schema.games).values(g).onConflictDoNothing().run();
  console.log(`[seed] games: ${games.length}`);

  for (const t of teams)
    db.insert(schema.teams).values(t).onConflictDoNothing().run();
  console.log(`[seed] teams: ${teams.length}`);

  for (const p of players)
    db.insert(schema.players)
      .values({ ...p, kda: Math.round(p.kda * 100) })
      .onConflictDoNothing()
      .run();
  console.log(`[seed] players: ${players.length}`);

  for (const e of events) {
    db.insert(schema.events)
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
      .onConflictDoNothing()
      .run();
    for (const tid of e.teamIds) {
      db.insert(schema.eventTeams)
        .values({ eventId: e.id, teamId: tid })
        .onConflictDoNothing()
        .run();
    }
  }
  console.log(`[seed] events: ${events.length}`);

  for (const m of matches)
    db.insert(schema.matches).values(m).onConflictDoNothing().run();
  console.log(`[seed] matches: ${matches.length}`);

  for (const s of streams) {
    const streamKey = `sk_live_${s.id.slice(-8)}`;
    db.insert(schema.streams)
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
      .onConflictDoNothing()
      .run();
  }
  console.log(`[seed] streams: ${streams.length} (stream keys derived from id; dev only)`);

  const streamIds = new Set(streams.map((s) => s.id));
  for (const v of vods)
    db.insert(schema.vods)
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
      .onConflictDoNothing()
      .run();
  console.log(`[seed] vods: ${vods.length}`);

  const vodIds = new Set(vods.map((v) => v.id));
  for (const c of clips)
    db.insert(schema.clips)
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
      .onConflictDoNothing()
      .run();
  console.log(`[seed] clips: ${clips.length}`);

  for (const s of mockSubs)
    db.insert(schema.subscriptions).values(s).onConflictDoNothing().run();
  console.log(`[seed] subscriptions: ${mockSubs.length}`);

  for (const p of mockProducts)
    db.insert(schema.products).values(p).onConflictDoNothing().run();
  console.log(`[seed] products: ${mockProducts.length}`);

  for (const o of mockOrders)
    db.insert(schema.orders).values(o).onConflictDoNothing().run();
  console.log(`[seed] orders: ${mockOrders.length}`);

  for (const a of mockAds)
    db.insert(schema.ads).values(a).onConflictDoNothing().run();
  console.log(`[seed] ads: ${mockAds.length}`);

  for (const n of mockNotifs)
    db.insert(schema.notifications).values(n).onConflictDoNothing().run();
  console.log(`[seed] notifications: ${mockNotifs.length}`);

  for (const p of mockPolls)
    db.insert(schema.polls)
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
      .onConflictDoNothing()
      .run();
  console.log(`[seed] polls: ${mockPolls.length}`);

  for (const f of mockFollows)
    db.insert(schema.follows).values(f).onConflictDoNothing().run();
  console.log(`[seed] follows: ${mockFollows.length}`);

  for (const f of mockFlags)
    db.insert(schema.featureFlags)
      .values({ key: f.key, enabled: f.enabled, description: f.description })
      .onConflictDoNothing()
      .run();
  console.log(`[seed] feature flags: ${mockFlags.length}`);

  console.log("[seed] done.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
