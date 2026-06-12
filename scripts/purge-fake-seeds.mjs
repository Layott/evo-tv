/**
 * purge-fake-seeds.mjs
 *
 * Zeroes out the fake "live" telemetry that db/seed.ts wrote from the mock
 * fixtures:
 *
 *   1. streams: is_live=false, viewer_count=0, peak_viewer_count=0 for the
 *      seeded demo stream ids (verified against lib/mock/streams.ts and
 *      db/schema/streaming.ts column names).
 *   2. games: active_players=0 for the four seeded slugs (verified against
 *      lib/mock/games.ts and db/schema/catalog.ts).
 *
 * UPDATE-only. There is no DELETE anywhere in this script. Rows stay in
 * place; only the fake counters and live flags are reset.
 *
 * Usage:
 *   node scripts/purge-fake-seeds.mjs --dry-run   # SELECT + print only
 *   node scripts/purge-fake-seeds.mjs             # apply the updates
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const URL =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL;
if (!URL) {
  console.error(
    "[purge-fake-seeds] No DB URL found (DATABASE_URL_UNPOOLED / DATABASE_URL / POSTGRES_URL_NON_POOLING / POSTGRES_URL)",
  );
  process.exit(1);
}
const sql = neon(URL);

const DRY_RUN = process.argv.includes("--dry-run");

// Seeded demo stream ids. Verified against lib/mock/streams.ts (2026-06-12).
// Note: lib/mock/streams.ts seeds SEVEN streams; stream_eafc_watch
// (viewerCount 480, isLive true) is included on top of the six originally
// flagged ids because db/seed.ts inserts it the same way.
const STREAM_IDS = [
  "channel_main",
  "stream_lagos_final",
  "stream_casablanca",
  "stream_codm_scrim",
  "stream_premium_analysis",
  "stream_talk_show",
  "stream_eafc_watch",
];

// Seeded game slugs. Verified against lib/mock/games.ts (2026-06-12).
const GAME_SLUGS = ["free-fire", "cod-mobile", "pubg-mobile", "ea-fc-mobile"];

async function purgeStreams() {
  const affected = await sql`
    SELECT id, is_live, viewer_count, peak_viewer_count
    FROM streams
    WHERE id = ANY(${STREAM_IDS})
      AND (is_live = true OR viewer_count <> 0 OR peak_viewer_count <> 0)
    ORDER BY id`;

  if (affected.length === 0) {
    console.log("streams: 0 rows need purging (already clean)");
    return;
  }

  for (const row of affected) {
    console.log(
      `  ${DRY_RUN ? "would update" : "updating"} streams.${row.id}: ` +
        `is_live=${row.is_live} viewer_count=${row.viewer_count} ` +
        `peak_viewer_count=${row.peak_viewer_count} -> false / 0 / 0`,
    );
  }

  if (DRY_RUN) {
    console.log(`streams: ${affected.length} row(s) WOULD be updated (dry run)`);
    return;
  }

  const updated = await sql`
    UPDATE streams
    SET is_live = false, viewer_count = 0, peak_viewer_count = 0
    WHERE id = ANY(${STREAM_IDS})
      AND (is_live = true OR viewer_count <> 0 OR peak_viewer_count <> 0)
    RETURNING id`;
  console.log(`streams: ${updated.length} row(s) updated`);
}

async function purgeGames() {
  const affected = await sql`
    SELECT id, slug, active_players
    FROM games
    WHERE slug = ANY(${GAME_SLUGS})
      AND active_players <> 0
    ORDER BY slug`;

  if (affected.length === 0) {
    console.log("games: 0 rows need purging (already clean)");
    return;
  }

  for (const row of affected) {
    console.log(
      `  ${DRY_RUN ? "would update" : "updating"} games.${row.slug} (${row.id}): ` +
        `active_players=${row.active_players} -> 0`,
    );
  }

  if (DRY_RUN) {
    console.log(`games: ${affected.length} row(s) WOULD be updated (dry run)`);
    return;
  }

  const updated = await sql`
    UPDATE games
    SET active_players = 0
    WHERE slug = ANY(${GAME_SLUGS})
      AND active_players <> 0
    RETURNING id`;
  console.log(`games: ${updated.length} row(s) updated`);
}

console.log(
  DRY_RUN
    ? "[purge-fake-seeds] DRY RUN: no writes will be made"
    : "[purge-fake-seeds] applying updates (UPDATE only, no deletes)",
);
await purgeStreams();
await purgeGames();
console.log("[purge-fake-seeds] done.");
