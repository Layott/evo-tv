import "dotenv/config";
import postgres from "postgres";
async function main() {
  const sql = postgres(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!, { max: 1 });
  try {
    console.log("--- shows ---");
    for (const r of await sql`select slug, title, pillar, origin_type, total_episodes from shows order by title`)
      console.log("  ", r.slug, "|", r.title, "|", r.pillar, "|", r.origin_type, "| eps", r.total_episodes);
    const cols = await sql`select column_name from information_schema.columns where table_name='streams' order by ordinal_position`;
    console.log("\n--- streams columns ---\n  ", cols.map((c: any) => c.column_name).join(", "));
    for (const r of await sql`select * from streams`) {
      console.log("\n--- the one stream ---");
      for (const [k, v] of Object.entries(r)) if (v !== null && v !== "" ) console.log("  ", k, "=", String(v).slice(0, 70));
    }
    const eps = await sql`select count(*)::int n, count(distinct hls_url)::int u from episodes`;
    console.log("\nepisodes:", eps[0]!.n, "distinct hls urls:", eps[0]!.u);
  } finally { await sql.end({ timeout: 5 }); }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
