import "dotenv/config";
import postgres from "postgres";

async function main() {
  const sql = postgres(
    process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!,
    { max: 1 },
  );
  try {
    const rows = await sql<{ t: string; n: number }[]>`
      select relname as t, n_live_tup::int as n
      from pg_stat_user_tables
      order by n_live_tup desc, relname`;
    const filled = rows.filter((r) => r.n > 0);
    console.log(`tables: ${rows.length}, with rows: ${filled.length}`);
    for (const r of filled) console.log(String(r.n).padStart(6), r.t);
    console.log("\nEMPTY:", rows.filter((r) => r.n === 0).map((r) => r.t).join(" "));
  } finally {
    await sql.end({ timeout: 5 });
  }
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
