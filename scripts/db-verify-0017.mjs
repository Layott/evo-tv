import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
const sql = neon(URL);

const cols = await sql`
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='daily_quest_claims'
  ORDER BY ordinal_position`;
console.log("=== daily_quest_claims columns ===");
console.table(cols);

const idx = await sql`
  SELECT indexname, indexdef
  FROM pg_indexes
  WHERE schemaname='public' AND tablename='daily_quest_claims'`;
console.log("\n=== daily_quest_claims indexes ===");
for (const i of idx) console.log(i.indexname, "→", i.indexdef);

const fk = await sql`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = 'public.daily_quest_claims'::regclass`;
console.log("\n=== daily_quest_claims constraints ===");
for (const c of fk) console.log(c.conname, "→", c.def);

const rowCount = await sql`SELECT count(*)::int FROM daily_quest_claims`;
console.log("\n=== daily_quest_claims rows ===", rowCount[0].count);
