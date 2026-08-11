/**
 * fix-channel-assets.ts - replaces placeholder imagery on the flagship channel.
 *
 * `streams.channel_main` is real infrastructure, not seed data, so the purge
 * scripts correctly leave it alone. Two of its fields are still placeholders
 * from the mock era:
 *
 *   streamer_avatar_url  https://evo-tv.vercel.app/...  a host that no longer
 *                        resolves since the move off Vercel, so the avatar is a
 *                        broken image everywhere the channel appears.
 *   thumbnail_url        https://picsum.photos/seed/... a random stock photo.
 *
 * Both are repointed at assets bundled in public/evo-logo/. Relative paths, so
 * they keep working whatever host serves the app.
 *
 * Usage:
 *   pnpm tsx scripts/fix-channel-assets.ts            # DRY RUN
 *   pnpm tsx scripts/fix-channel-assets.ts --apply
 *
 * Only rewrites a field when it still matches the known placeholder, so a value
 * an admin has since set by hand is never clobbered.
 */
import "./_env";
import postgres from "postgres";

const AVATAR = "/evo-logo/evo-tv-152.png";
const THUMBNAIL = "/evo-logo/evo-tv-hero.png";

const APPLY = process.argv.includes("--apply");

async function main() {
  const url =
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;
  if (!url) {
    console.error("[fix-channel-assets] No database URL in the environment");
    process.exit(1);
  }

  const sql = postgres(url, { max: 1 });
  try {
    const rows = await sql`
      select id, streamer_avatar_url, thumbnail_url from streams
      where streamer_avatar_url like '%evo-tv.vercel.app%'
         or thumbnail_url like '%picsum.photos%'`;

    console.log(`[fix-channel-assets] ${APPLY ? "APPLY" : "DRY RUN"}`);
    console.log(`  rows with placeholder assets: ${rows.length}`);
    for (const r of rows) {
      console.log(`    - ${r.id}`);
      console.log(`        avatar    ${r.streamer_avatar_url}`);
      console.log(`        thumbnail ${r.thumbnail_url}`);
    }
    if (rows.length === 0) {
      console.log("[fix-channel-assets] nothing to do");
      return;
    }
    if (!APPLY) {
      console.log("[fix-channel-assets] dry run. Re-run with --apply");
      return;
    }

    const avatars = await sql`
      update streams set streamer_avatar_url = ${AVATAR}
      where streamer_avatar_url like '%evo-tv.vercel.app%' returning id`;
    const thumbs = await sql`
      update streams set thumbnail_url = ${THUMBNAIL}
      where thumbnail_url like '%picsum.photos%' returning id`;

    console.log(`[fix-channel-assets] avatars rewritten:    ${avatars.length}`);
    console.log(`[fix-channel-assets] thumbnails rewritten: ${thumbs.length}`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[fix-channel-assets] failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
