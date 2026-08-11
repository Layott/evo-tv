/**
 * purge-fake-originals.ts - removes the seeded demo shows, seasons and episodes.
 *
 * Companion to scripts/purge-fake-content.ts, which cleared vods, clips,
 * products, orders and the demo accounts but never touched the Originals
 * catalogue. Those rows came from POST /api/admin/db/seed-originals and are
 * entirely invented: five shows that do not exist, and 42 episodes whose
 * hls_url is a single public Mux test stream.
 *
 * Usage:
 *   pnpm tsx scripts/purge-fake-originals.ts            # DRY RUN, counts only
 *   pnpm tsx scripts/purge-fake-originals.ts --apply    # actually delete
 *
 * Deletes by EXACT id, never by pattern, so a real show that happens to share a
 * word with one of these is untouched. The ids are copied from the seed route.
 *
 * FK behaviour, verified against db/schema/shows.ts:
 *   seasons.show_id            -> ON DELETE CASCADE
 *   episodes.show_id           -> ON DELETE CASCADE
 *   episodes.season_id         -> ON DELETE CASCADE
 *   episode_progress.episode_id-> ON DELETE CASCADE
 *   show_watchlist.show_id     -> ON DELETE CASCADE
 * So deleting the shows is sufficient. The script still reports what went with
 * them, and refuses to run if any real user progress or watchlist row would be
 * destroyed as collateral.
 */
import "dotenv/config";
import postgres from "postgres";

/** Exactly the ids created by app/api/admin/db/seed-originals/route.ts. */
const SEEDED_SHOW_IDS = [
  "show_naija_esports_inside",
  "show_otaku_court",
  "show_sukuna_armor_diaries",
  "show_lagos_after_dark",
  "show_continent_tech",
] as const;

/** postgres-js expands `in ${sql(array)}` into a value list. */
const SHOW_IDS = [...SEEDED_SHOW_IDS];

const APPLY = process.argv.includes("--apply");

async function main() {
  const url =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;
  if (!url) {
    console.error("[purge-originals] No database URL in the environment");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const shows = await sql`
      select id, slug, title from shows where id in ${sql(SHOW_IDS)}`;
    const seasons = await sql`
      select count(*)::int as n from seasons where show_id in ${sql(SHOW_IDS)}`;
    const episodes = await sql`
      select count(*)::int as n from episodes where show_id in ${sql(SHOW_IDS)}`;
    const progress = await sql`
      select count(*)::int as n from episode_progress p
      join episodes e on e.id = p.episode_id
      where e.show_id in ${sql(SHOW_IDS)}`;
    const watchlist = await sql`
      select count(*)::int as n from show_watchlist where show_id in ${sql(SHOW_IDS)}`;

    console.log(`[purge-originals] ${APPLY ? "APPLY" : "DRY RUN"}`);
    console.log(`  shows matched      ${shows.length}`);
    for (const s of shows) console.log(`    - ${s.id}  ${s.slug}  ${s.title}`);
    console.log(`  seasons            ${seasons[0]!.n}`);
    console.log(`  episodes           ${episodes[0]!.n}`);
    console.log(`  episode_progress   ${progress[0]!.n}  (cascades)`);
    console.log(`  show_watchlist     ${watchlist[0]!.n}  (cascades)`);

    if (shows.length === 0) {
      console.log("[purge-originals] nothing to do");
      return;
    }

    // Refuse to destroy real user state as collateral. If someone has genuinely
    // watched or saved one of these, a human should decide.
    if (progress[0]!.n > 0 || watchlist[0]!.n > 0) {
      console.error(
        "[purge-originals] REFUSING: real user progress or watchlist rows " +
          "reference these shows. Resolve by hand.",
      );
      process.exitCode = 1;
      return;
    }

    if (!APPLY) {
      console.log("[purge-originals] dry run, nothing deleted. Re-run with --apply");
      return;
    }

    const deleted = await sql`
      delete from shows where id in ${sql(SHOW_IDS)} returning id`;
    const left = await sql`select count(*)::int as n from shows`;
    const epLeft = await sql`select count(*)::int as n from episodes`;
    console.log(`[purge-originals] deleted ${deleted.length} shows`);
    console.log(`[purge-originals] remaining: shows ${left[0]!.n}, episodes ${epLeft[0]!.n}`);
  } finally {
    // postgres-js keeps the event loop alive; without this the script hangs.
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[purge-originals] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
