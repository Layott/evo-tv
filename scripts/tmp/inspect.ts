import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!, { max: 1 });
  try {
    console.log("--- shows ---");
    for (const r of await sql`select id, slug, title, pillar, origin_type, total_episodes from shows order by title`)
      console.log(" ", r.id, "|", r.slug, "|", r.title, "|", r.pillar, "|", r.origin_type, "| eps", r.total_episodes);
    console.log("--- episodes (sample) ---");
    for (const r of await sql`select id, show_id, season_number, episode_number, title, hls_url from episodes order by show_id, season_number, episode_number limit 8`)
      console.log(" ", r.show_id, `S${r.season_number}E${r.episode_number}`, "|", r.title, "| hls:", (r.hls_url || "").slice(0, 60));
    console.log("--- games ---");
    for (const r of await sql`select id, slug, name from games`) console.log(" ", r.id, "|", r.slug, "|", r.name);
    console.log("--- channels ---");
    for (const r of await sql`select id, slug, name from channels`) console.log(" ", r.id, "|", r.slug, "|", r.name);
    console.log("--- streams ---");
    for (const r of await sql`select id, title, is_live, hls_url, streamer_name from streams`)
      console.log(" ", r.id, "|", r.title, "| live:", r.is_live, "|", r.streamer_name, "| hls:", (r.hls_url || "").slice(0, 50));
  } finally { await sql.end({ timeout: 5 }); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
