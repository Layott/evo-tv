/**
 * purge-fake-content.ts - removes the seeded mock CONTENT rows from the DB.
 *
 * Companion to scripts/inventory-fake-seeds.ts (read-only scan) and
 * scripts/purge-fake-seeds.mjs (telemetry zeroing). This script DELETES the
 * fake content and demo accounts, then re-runs the telemetry neutralization
 * so one invocation finishes the whole cleanup.
 *
 * Usage:
 *   pnpm tsx scripts/purge-fake-content.ts            # DRY RUN (default): SELECT + print only
 *   pnpm tsx scripts/purge-fake-content.ts --apply    # actually delete / update
 *
 * What gets DELETED (exact ids imported from lib/mock/*, never patterns):
 *   - vods (30), clips (10), polls (2), ads (4), notifications (15),
 *     orders (2), products (8), subscriptions (sub_1)
 *   - 6 of the 7 seeded streams: stream_lagos_final, stream_casablanca,
 *     stream_codm_scrim, stream_eafc_watch, stream_premium_analysis,
 *     stream_talk_show. These are fake content, not infra.
 *   - the 23 mock demo users (user_current, user_admin, user_premium,
 *     user_10..user_29), minus any excluded by the paranoia guard below.
 *
 * What gets KEPT but neutralized (apply mode only):
 *   - games (4 rows): real category catalog. active_players=0 only.
 *   - streams.channel_main: flagship linear-channel row. is_live=false,
 *     viewer_count=0, peak_viewer_count=0, and the em-dash title variant
 *     ("EVO TV Channel <emdash> 24/7 Esports") rewritten to
 *     "EVO TV Channel: 24/7 Esports". Title update only fires when the
 *     current title matches the old variant exactly, so a manually edited
 *     title is never clobbered.
 *
 * Why the 6 streams are FK-safe to delete (verified against db/schema/*.ts):
 *   - vods.stream_id          -> ON DELETE SET NULL
 *   - clips.stream_id         -> ON DELETE SET NULL
 *   - chat_messages.stream_id -> ON DELETE CASCADE
 *   - polls.stream_id         -> ON DELETE CASCADE
 *   - parties.stream_id       -> ON DELETE SET NULL
 *   - matches: has NO stream column (db/schema/events.ts), nothing to break.
 *   - tips.stream_id, watch_events.stream_id: plain text, NO FK constraint.
 *     Dangling text ids may remain; harmless, documented here.
 *
 * FK MAP (db/schema/*.ts, 2026-06-12):
 *   CASCADE on user delete (rely on it, no explicit child deletes):
 *     session, account, profiles, user_prefs, notifications,
 *     push_subscriptions, expo_push_tokens, reminders, epg_reminders,
 *     idempotency_keys, orders, subscriptions, chat_messages, poll_votes,
 *     follows, likes, vod_progress, vod_bookmarks, publisher_members,
 *     channel_followers, parties (host; cascades party_members +
 *     party_messages), coin_balances, rewards_redemptions, xp_events,
 *     daily_quest_claims, tips (from + to), prediction_picks, pickem_entries,
 *     api_keys, login_events, creator_applications, fantasy_leagues (owner;
 *     cascades members/lineups/picks/activity), episode_progress,
 *     show_watchlist, user_sanctions.user_id.
 *   SET NULL on user delete (automatic, nothing to do):
 *     audit_log.actor_id, watch_events.user_id,
 *     content_reports.reporter_user_id, email_templates.updated_by.
 *   NO ACTION blockers on user delete (handled explicitly BEFORE the delete):
 *     user_sanctions.issued_by  (NOT NULL -> DELETE those sanction rows;
 *                                they are sanctions issued by demo accounts)
 *     user_sanctions.reverted_by (nullable -> UPDATE to NULL)
 *     content_reports.resolved_by (nullable -> UPDATE to NULL)
 *   CASCADE on vod delete:  vod_progress, vod_bookmarks.
 *   SET NULL on vod delete: clips.vod_id.
 *   CASCADE on poll delete: poll_votes.
 *   Polymorphic, NO FK (cleaned explicitly where they point at deleted rows):
 *     likes(target_type,target_id)            -> deleted for mock vod/clip ids
 *     epg_reminders.target_id                 -> deleted for deleted-stream ids
 *                                                (raw + "stream_" prefixed form)
 *     content_reports / audit_log target ids  -> LEFT IN PLACE on purpose
 *                                                (moderation + audit history)
 *   Commerce: orders.items is JSONB. There is NO order_items table, so
 *   products and orders have zero relational dependents.
 *
 * DELETION ORDER (apply mode, single atomic batch):
 *    1. UPDATE user_sanctions.reverted_by -> NULL  (mock actor ids)
 *    2. DELETE user_sanctions WHERE issued_by IN mock users
 *    3. UPDATE content_reports.resolved_by -> NULL (mock actor ids)
 *    4. DELETE likes targeting mock vods / clips   (polymorphic, no FK)
 *    5. DELETE epg_reminders targeting deleted streams (polymorphic, no FK)
 *    6. DELETE clips        (before vods/streams; avoids SET NULL churn)
 *    7. DELETE vods         (vod_progress / vod_bookmarks cascade)
 *    8. DELETE polls        (poll_votes cascade)
 *    9. DELETE 6 fake streams (chat_messages + stray polls cascade)
 *   10. DELETE ads
 *   11. DELETE notifications (seeded ids; the rest cascade with users)
 *   12. DELETE orders
 *   13. DELETE products
 *   14. DELETE subscriptions (sub_1)
 *   15. DELETE mock users    (all CASCADE / SET NULL children fan out here)
 *   16. UPDATE streams.channel_main: is_live=false, counts 0
 *   17. UPDATE streams.channel_main: title em-dash variant -> colon variant
 *   18. UPDATE games: active_players=0
 *
 * TRANSACTION NOTE: the Neon HTTP driver does NOT support interactive
 * multi-statement transactions, but @neondatabase/serverless v1.x DOES
 * support sql.transaction([...]) - a non-interactive batch where every query
 * is precomputed client-side and the server runs the whole batch in ONE
 * atomic transaction. All ids here are known up front, so apply mode uses
 * that: any FK surprise rolls back EVERYTHING and the DB is untouched.
 * Caveat: the paranoia-guard SELECTs run before the batch (the batch cannot
 * branch on its own results), so there is a tiny check-then-act window.
 *
 * PARANOIA GUARD (rail 2): a mock user id is EXCLUDED from deletion when
 *   - it owns a subscriptions row whose id is NOT in the mock sub id list, or
 *   - it owns an orders row whose id is NOT in the mock order id list, or
 *   - it has ANY Better-Auth account row (db/seed.ts never creates account
 *     rows, so one existing means a real credential got attached).
 * Exclusions are printed loudly in both modes.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

import { games } from "../lib/mock/games";
import { streams } from "../lib/mock/streams";
import { vods, clips } from "../lib/mock/vods";
import { profiles as mockProfiles } from "../lib/mock/users";
import { subscriptions as mockSubs } from "../lib/mock/subs";
import { products as mockProducts } from "../lib/mock/products";
import { orders as mockOrders } from "../lib/mock/orders";
import { ads as mockAds } from "../lib/mock/ads";
import { notifications as mockNotifs } from "../lib/mock/notifications";
import { polls as mockPolls } from "../lib/mock/polls";

const URL =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL;
if (!URL) {
  console.error("[purge-fake-content] no DB URL in env");
  process.exit(1);
}
const sql = neon(URL);

// --apply is required for writes; anything else (including an explicit
// --dry-run) stays read-only. If both flags are passed, dry-run wins.
const APPLY = process.argv.includes("--apply") && !process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Exact id lists. Sourced from lib/mock/* only; no patterns, no LIKE.
// ---------------------------------------------------------------------------

const GAME_IDS = games.map((g) => g.id); // 4: kept, neutralized
const KEEP_STREAM_ID = "channel_main"; // flagship linear channel: kept
const STREAM_DELETE_IDS = streams.map((s) => s.id).filter((id) => id !== KEEP_STREAM_ID); // 6
const VOD_IDS = vods.map((v) => v.id); // 30
const CLIP_IDS = clips.map((c) => c.id); // 10
const USER_IDS = mockProfiles.map((p) => p.id); // 23
const SUB_IDS = mockSubs.map((s) => s.id); // 1: sub_1
const PRODUCT_IDS = mockProducts.map((p) => p.id); // 8
const ORDER_IDS = mockOrders.map((o) => o.id); // 2
const AD_IDS = mockAds.map((a) => a.id); // 4
const NOTIF_IDS = mockNotifs.map((n) => n.id); // 15
const POLL_IDS = mockPolls.map((p) => p.id); // 2

// epg_reminders.target_id is polymorphic text shaped "stream_<id>" (or a raw
// id in older rows). Cover both forms for the streams being deleted.
const EPG_STREAM_TARGETS = [
  ...STREAM_DELETE_IDS,
  ...STREAM_DELETE_IDS.map((id) => `stream_${id}`),
];

// channel_main title rewrite. The old variant contains an em dash; built via
// String.fromCharCode so this file stays em-dash-free. Exact match only.
const EM_DASH = String.fromCharCode(0x2014);
const CHANNEL_MAIN_OLD_TITLE = `EVO TV Channel ${EM_DASH} 24/7 Esports`;
const CHANNEL_MAIN_NEW_TITLE = "EVO TV Channel: 24/7 Esports";

// ---------------------------------------------------------------------------
// Paranoia guard: which mock users are actually safe to delete?
// ---------------------------------------------------------------------------

interface GuardResult {
  deletable: string[];
  excluded: { id: string; reason: string }[];
}

async function runParanoiaGuard(): Promise<GuardResult> {
  const excluded = new Map<string, string>();

  const realSubs = (await sql`
    SELECT DISTINCT user_id FROM subscriptions
    WHERE user_id = ANY(${USER_IDS}) AND NOT (id = ANY(${SUB_IDS}))`) as Array<{
    user_id: string;
  }>;
  for (const r of realSubs) excluded.set(r.user_id, "has a non-mock subscriptions row");

  const realOrders = (await sql`
    SELECT DISTINCT user_id FROM orders
    WHERE user_id = ANY(${USER_IDS}) AND NOT (id = ANY(${ORDER_IDS}))`) as Array<{
    user_id: string;
  }>;
  for (const r of realOrders) {
    if (!excluded.has(r.user_id)) excluded.set(r.user_id, "has a non-mock orders row");
  }

  // db/seed.ts never writes account rows; one existing means real credentials.
  const accountRows = (await sql`
    SELECT DISTINCT user_id FROM account WHERE user_id = ANY(${USER_IDS})`) as Array<{
    user_id: string;
  }>;
  for (const r of accountRows) {
    if (!excluded.has(r.user_id)) excluded.set(r.user_id, "has a Better-Auth account row");
  }

  return {
    deletable: USER_IDS.filter((id) => !excluded.has(id)),
    excluded: [...excluded.entries()].map(([id, reason]) => ({ id, reason })),
  };
}

// ---------------------------------------------------------------------------
// Dry run: count everything that WOULD be deleted or updated.
// ---------------------------------------------------------------------------

async function countOne(label: string, query: Promise<unknown>): Promise<void> {
  try {
    const rows = (await query) as Array<{ n: number }>;
    const n = rows[0]?.n ?? 0;
    console.log(`  ${label.padEnd(58)} ${String(n).padStart(6)}`);
  } catch (err) {
    console.log(
      `  ${label.padEnd(58)}  ERROR: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`,
    );
  }
}

async function dryRun(guard: GuardResult): Promise<void> {
  const u = guard.deletable;

  console.log("\n-- direct deletions (rows matched by exact mock id) --");
  await countOne("vods", sql`SELECT count(*)::int AS n FROM vods WHERE id = ANY(${VOD_IDS})`);
  await countOne("clips", sql`SELECT count(*)::int AS n FROM clips WHERE id = ANY(${CLIP_IDS})`);
  await countOne("polls", sql`SELECT count(*)::int AS n FROM polls WHERE id = ANY(${POLL_IDS})`);
  await countOne("ads", sql`SELECT count(*)::int AS n FROM ads WHERE id = ANY(${AD_IDS})`);
  await countOne(
    "notifications (seeded ids)",
    sql`SELECT count(*)::int AS n FROM notifications WHERE id = ANY(${NOTIF_IDS})`,
  );
  await countOne("orders", sql`SELECT count(*)::int AS n FROM orders WHERE id = ANY(${ORDER_IDS})`);
  await countOne(
    "products",
    sql`SELECT count(*)::int AS n FROM products WHERE id = ANY(${PRODUCT_IDS})`,
  );
  await countOne(
    "subscriptions",
    sql`SELECT count(*)::int AS n FROM subscriptions WHERE id = ANY(${SUB_IDS})`,
  );
  await countOne(
    "streams (6 fake, channel_main excluded)",
    sql`SELECT count(*)::int AS n FROM streams WHERE id = ANY(${STREAM_DELETE_IDS})`,
  );
  await countOne(
    `"user" (after paranoia guard: ${u.length}/${USER_IDS.length} eligible)`,
    sql`SELECT count(*)::int AS n FROM "user" WHERE id = ANY(${u})`,
  );
  await countOne(
    "user_sanctions issued_by mock users (explicit delete)",
    sql`SELECT count(*)::int AS n FROM user_sanctions WHERE issued_by = ANY(${u})`,
  );
  await countOne(
    "likes -> mock vods/clips (polymorphic, no FK)",
    sql`SELECT count(*)::int AS n FROM likes
        WHERE (target_type = 'vod' AND target_id = ANY(${VOD_IDS}))
           OR (target_type = 'clip' AND target_id = ANY(${CLIP_IDS}))`,
  );
  await countOne(
    "epg_reminders -> deleted streams (polymorphic, no FK)",
    sql`SELECT count(*)::int AS n FROM epg_reminders WHERE target_id = ANY(${EPG_STREAM_TARGETS})`,
  );

  console.log("\n-- pre-delete NULL-outs (NO ACTION FK unblockers) --");
  await countOne(
    "user_sanctions.reverted_by -> NULL",
    sql`SELECT count(*)::int AS n FROM user_sanctions WHERE reverted_by = ANY(${u})`,
  );
  await countOne(
    "content_reports.resolved_by -> NULL",
    sql`SELECT count(*)::int AS n FROM content_reports WHERE resolved_by = ANY(${u})`,
  );

  console.log("\n-- dependents removed via ON DELETE CASCADE --");
  await countOne(
    "session (mock users)",
    sql`SELECT count(*)::int AS n FROM session WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "account (mock users; expected 0)",
    sql`SELECT count(*)::int AS n FROM account WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "profiles (mock users)",
    sql`SELECT count(*)::int AS n FROM profiles WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "user_prefs (mock users)",
    sql`SELECT count(*)::int AS n FROM user_prefs WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "follows (mock users)",
    sql`SELECT count(*)::int AS n FROM follows WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "notifications (mock users, beyond seeded ids)",
    sql`SELECT count(*)::int AS n FROM notifications
        WHERE user_id = ANY(${u}) AND NOT (id = ANY(${NOTIF_IDS}))`,
  );
  await countOne(
    "chat_messages (mock users)",
    sql`SELECT count(*)::int AS n FROM chat_messages WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "chat_messages (on the 6 deleted streams)",
    sql`SELECT count(*)::int AS n FROM chat_messages WHERE stream_id = ANY(${STREAM_DELETE_IDS})`,
  );
  await countOne(
    "poll_votes (on seeded polls)",
    sql`SELECT count(*)::int AS n FROM poll_votes WHERE poll_id = ANY(${POLL_IDS})`,
  );
  await countOne(
    "polls (on the 6 deleted streams, beyond seeded ids)",
    sql`SELECT count(*)::int AS n FROM polls
        WHERE stream_id = ANY(${STREAM_DELETE_IDS}) AND NOT (id = ANY(${POLL_IDS}))`,
  );
  await countOne(
    "vod_progress (on seeded vods)",
    sql`SELECT count(*)::int AS n FROM vod_progress WHERE vod_id = ANY(${VOD_IDS})`,
  );
  await countOne(
    "vod_bookmarks (on seeded vods)",
    sql`SELECT count(*)::int AS n FROM vod_bookmarks WHERE vod_id = ANY(${VOD_IDS})`,
  );
  await countOne(
    "tips (from or to mock users)",
    sql`SELECT count(*)::int AS n FROM tips
        WHERE from_user_id = ANY(${u}) OR to_user_id = ANY(${u})`,
  );
  await countOne(
    "coin_balances (mock users)",
    sql`SELECT count(*)::int AS n FROM coin_balances WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "xp_events (mock users)",
    sql`SELECT count(*)::int AS n FROM xp_events WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "rewards_redemptions (mock users)",
    sql`SELECT count(*)::int AS n FROM rewards_redemptions WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "daily_quest_claims (mock users)",
    sql`SELECT count(*)::int AS n FROM daily_quest_claims WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "prediction_picks (mock users)",
    sql`SELECT count(*)::int AS n FROM prediction_picks WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "pickem_entries (mock users)",
    sql`SELECT count(*)::int AS n FROM pickem_entries WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "parties hosted by mock users (members+messages cascade)",
    sql`SELECT count(*)::int AS n FROM parties WHERE host_user_id = ANY(${u})`,
  );
  await countOne(
    "fantasy_leagues owned by mock users (children cascade)",
    sql`SELECT count(*)::int AS n FROM fantasy_leagues WHERE owner_id = ANY(${u})`,
  );
  await countOne(
    "api_keys (mock users)",
    sql`SELECT count(*)::int AS n FROM api_keys WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "login_events (mock users)",
    sql`SELECT count(*)::int AS n FROM login_events WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "creator_applications (mock users)",
    sql`SELECT count(*)::int AS n FROM creator_applications WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "publisher_members (mock users)",
    sql`SELECT count(*)::int AS n FROM publisher_members WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "channel_followers (mock users)",
    sql`SELECT count(*)::int AS n FROM channel_followers WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "user_sanctions on mock users (user_id cascade)",
    sql`SELECT count(*)::int AS n FROM user_sanctions WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "push_subscriptions (mock users)",
    sql`SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "expo_push_tokens (mock users)",
    sql`SELECT count(*)::int AS n FROM expo_push_tokens WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "reminders (mock users)",
    sql`SELECT count(*)::int AS n FROM reminders WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "epg_reminders (mock users)",
    sql`SELECT count(*)::int AS n FROM epg_reminders WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "idempotency_keys (mock users)",
    sql`SELECT count(*)::int AS n FROM idempotency_keys WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "episode_progress (mock users)",
    sql`SELECT count(*)::int AS n FROM episode_progress WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "show_watchlist (mock users)",
    sql`SELECT count(*)::int AS n FROM show_watchlist WHERE user_id = ANY(${u})`,
  );

  console.log("\n-- references auto-NULLed by ON DELETE SET NULL (kept rows) --");
  await countOne(
    "audit_log.actor_id -> NULL",
    sql`SELECT count(*)::int AS n FROM audit_log WHERE actor_id = ANY(${u})`,
  );
  await countOne(
    "watch_events.user_id -> NULL",
    sql`SELECT count(*)::int AS n FROM watch_events WHERE user_id = ANY(${u})`,
  );
  await countOne(
    "content_reports.reporter_user_id -> NULL",
    sql`SELECT count(*)::int AS n FROM content_reports WHERE reporter_user_id = ANY(${u})`,
  );
  await countOne(
    "email_templates.updated_by -> NULL",
    sql`SELECT count(*)::int AS n FROM email_templates WHERE updated_by = ANY(${u})`,
  );
  await countOne(
    "vods.stream_id -> NULL (non-mock vods on deleted streams)",
    sql`SELECT count(*)::int AS n FROM vods
        WHERE stream_id = ANY(${STREAM_DELETE_IDS}) AND NOT (id = ANY(${VOD_IDS}))`,
  );
  await countOne(
    "clips.stream_id -> NULL (non-mock clips on deleted streams)",
    sql`SELECT count(*)::int AS n FROM clips
        WHERE stream_id = ANY(${STREAM_DELETE_IDS}) AND NOT (id = ANY(${CLIP_IDS}))`,
  );
  await countOne(
    "parties.stream_id -> NULL",
    sql`SELECT count(*)::int AS n FROM parties WHERE stream_id = ANY(${STREAM_DELETE_IDS})`,
  );

  console.log("\n-- keepers that would be UPDATED, not deleted --");
  try {
    const main = (await sql`
      SELECT id, title, is_live, viewer_count, peak_viewer_count
      FROM streams WHERE id = ${KEEP_STREAM_ID}`) as Array<{
      id: string;
      title: string;
      is_live: boolean;
      viewer_count: number;
      peak_viewer_count: number;
    }>;
    if (main.length === 0) {
      console.log("  streams.channel_main: NOT FOUND (nothing to neutralize)");
    } else {
      const row = main[0]!;
      console.log(
        `  streams.channel_main: is_live=${row.is_live} viewer_count=${row.viewer_count} peak=${row.peak_viewer_count}`,
      );
      console.log(`    current title: ${JSON.stringify(row.title)}`);
      console.log(
        row.title === CHANNEL_MAIN_OLD_TITLE
          ? `    title WOULD be rewritten to: ${JSON.stringify(CHANNEL_MAIN_NEW_TITLE)}`
          : row.title === CHANNEL_MAIN_NEW_TITLE
            ? "    title already in the colon form, no rewrite needed"
            : "    title does NOT match the old em-dash variant; rewrite would be SKIPPED",
      );
    }
  } catch (err) {
    console.log(
      `  streams.channel_main: ERROR ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`,
    );
  }
  await countOne(
    "games rows with active_players <> 0 (set to 0)",
    sql`SELECT count(*)::int AS n FROM games WHERE id = ANY(${GAME_IDS}) AND active_players <> 0`,
  );

  console.log(
    "\n[purge-fake-content] DRY RUN complete. No rows were modified. Re-run with --apply to execute.",
  );
}

// ---------------------------------------------------------------------------
// Apply: one atomic non-interactive batch (single Postgres transaction).
// ---------------------------------------------------------------------------

async function apply(guard: GuardResult): Promise<void> {
  const u = guard.deletable;

  const labels: string[] = [];
  const queries: ReturnType<typeof sql>[] = [];
  const step = (label: string, q: ReturnType<typeof sql>) => {
    labels.push(label);
    queries.push(q);
  };

  // 1-3: unblock the NO ACTION FKs pointing at mock users.
  step(
    "user_sanctions.reverted_by -> NULL",
    sql`UPDATE user_sanctions SET reverted_by = NULL WHERE reverted_by = ANY(${u}) RETURNING id`,
  );
  step(
    "user_sanctions issued_by mock users DELETED",
    sql`DELETE FROM user_sanctions WHERE issued_by = ANY(${u}) RETURNING id`,
  );
  step(
    "content_reports.resolved_by -> NULL",
    sql`UPDATE content_reports SET resolved_by = NULL WHERE resolved_by = ANY(${u}) RETURNING id`,
  );
  // 4-5: polymorphic no-FK cleanups.
  step(
    "likes -> mock vods/clips DELETED",
    sql`DELETE FROM likes
        WHERE (target_type = 'vod' AND target_id = ANY(${VOD_IDS}))
           OR (target_type = 'clip' AND target_id = ANY(${CLIP_IDS}))
        RETURNING target_id`,
  );
  step(
    "epg_reminders -> deleted streams DELETED",
    sql`DELETE FROM epg_reminders WHERE target_id = ANY(${EPG_STREAM_TARGETS}) RETURNING target_id`,
  );
  // 6-15: content + accounts, children before parents.
  step("clips DELETED", sql`DELETE FROM clips WHERE id = ANY(${CLIP_IDS}) RETURNING id`);
  step("vods DELETED", sql`DELETE FROM vods WHERE id = ANY(${VOD_IDS}) RETURNING id`);
  step("polls DELETED", sql`DELETE FROM polls WHERE id = ANY(${POLL_IDS}) RETURNING id`);
  step(
    "streams (6 fake) DELETED",
    sql`DELETE FROM streams WHERE id = ANY(${STREAM_DELETE_IDS}) RETURNING id`,
  );
  step("ads DELETED", sql`DELETE FROM ads WHERE id = ANY(${AD_IDS}) RETURNING id`);
  step(
    "notifications DELETED",
    sql`DELETE FROM notifications WHERE id = ANY(${NOTIF_IDS}) RETURNING id`,
  );
  step("orders DELETED", sql`DELETE FROM orders WHERE id = ANY(${ORDER_IDS}) RETURNING id`);
  step("products DELETED", sql`DELETE FROM products WHERE id = ANY(${PRODUCT_IDS}) RETURNING id`);
  step(
    "subscriptions DELETED",
    sql`DELETE FROM subscriptions WHERE id = ANY(${SUB_IDS}) RETURNING id`,
  );
  step(
    "mock users DELETED (cascade fans out)",
    sql`DELETE FROM "user" WHERE id = ANY(${u}) RETURNING id`,
  );
  // 16-18: neutralize the keepers.
  step(
    "streams.channel_main telemetry zeroed",
    sql`UPDATE streams SET is_live = false, viewer_count = 0, peak_viewer_count = 0
        WHERE id = ${KEEP_STREAM_ID}
          AND (is_live = true OR viewer_count <> 0 OR peak_viewer_count <> 0)
        RETURNING id`,
  );
  step(
    "streams.channel_main title rewritten",
    sql`UPDATE streams SET title = ${CHANNEL_MAIN_NEW_TITLE}
        WHERE id = ${KEEP_STREAM_ID} AND title = ${CHANNEL_MAIN_OLD_TITLE}
        RETURNING id`,
  );
  step(
    "games.active_players zeroed",
    sql`UPDATE games SET active_players = 0
        WHERE id = ANY(${GAME_IDS}) AND active_players <> 0
        RETURNING id`,
  );

  console.log(`\n[purge-fake-content] APPLY: executing ${queries.length} statements atomically`);
  const results = (await sql.transaction(queries)) as Array<Array<Record<string, unknown>>>;

  console.log("\n-- affected counts (via RETURNING) --");
  results.forEach((rows, i) => {
    console.log(`  ${(labels[i] ?? `step ${i + 1}`).padEnd(58)} ${String(rows.length).padStart(6)}`);
  });
  console.log("\n[purge-fake-content] APPLY complete. Transaction committed.");
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(
    APPLY
      ? "[purge-fake-content] APPLY MODE: rows WILL be deleted/updated"
      : "[purge-fake-content] DRY RUN (default): SELECT + print only. Pass --apply to execute.",
  );
  console.log(
    `[purge-fake-content] targets: ${VOD_IDS.length} vods, ${CLIP_IDS.length} clips, ` +
      `${POLL_IDS.length} polls, ${AD_IDS.length} ads, ${NOTIF_IDS.length} notifications, ` +
      `${ORDER_IDS.length} orders, ${PRODUCT_IDS.length} products, ${SUB_IDS.length} subscription(s), ` +
      `${STREAM_DELETE_IDS.length} streams (keeping ${KEEP_STREAM_ID}), ${USER_IDS.length} users`,
  );

  const guard = await runParanoiaGuard();
  if (guard.excluded.length > 0) {
    console.log("\n[paranoia guard] EXCLUDED from user deletion:");
    for (const e of guard.excluded) console.log(`  ${e.id.padEnd(16)} ${e.reason}`);
  } else {
    console.log("\n[paranoia guard] all 23 mock users clear for deletion (no real activity found)");
  }

  if (APPLY) {
    await apply(guard);
  } else {
    await dryRun(guard);
  }
}

main().catch((err) => {
  console.error("[purge-fake-content] FAILED:", err instanceof Error ? err.message : err);
  console.error(
    "[purge-fake-content] apply mode is atomic: on failure the transaction rolled back and nothing changed.",
  );
  process.exit(1);
});
