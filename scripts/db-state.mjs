import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!URL) { console.error("no DB url"); process.exit(1); }
const sql = neon(URL);

const migTables = await sql`
  SELECT table_schema, table_name
  FROM information_schema.tables
  WHERE table_name = '__drizzle_migrations'`;
console.log("=== __drizzle_migrations location ===");
console.log(migTables.length ? migTables : "(none — fresh / never tracked)");

const journal = await sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`;
console.log("\n=== journal rows (" + journal.length + ") ===");
for (const r of journal) console.log(r.id, new Date(Number(r.created_at)).toISOString(), r.hash.slice(0, 16));

const targets = ["channels","streams","vods","clips","user","user_sanctions","content_reports","login_events","email_templates","party_messages","api_keys","admin_audit_log","daily_quest_claims","shows","seasons","episodes","episode_progress","show_watchlist"];
const tables = await sql`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name = ANY(${targets})
  ORDER BY table_name`;
console.log("\n=== relevant tables present ===");
console.log(tables.map(t => t.table_name).join("\n"));

const channelCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='channels' AND column_name IN ('pillar','suspended_at','suspended_reason')
  ORDER BY column_name`;
console.log("\n=== channels relevant cols ===");
console.log(channelCols.map(c => c.column_name).join(", "));

const streamCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='streams' AND column_name IN ('pillar','deleted_at')
  ORDER BY column_name`;
console.log("\n=== streams relevant cols ===");
console.log(streamCols.map(c => c.column_name).join(", "));

const userCols = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='user' AND column_name IN ('suspended_at','banned_at','chat_banned_at','deleted_at')
  ORDER BY column_name`;
console.log("\n=== user sanction cols ===");
console.log(userCols.map(c => c.column_name).join(", "));

const auditCount = tables.find(t => t.table_name === "admin_audit_log")
  ? await sql`SELECT count(*)::int FROM admin_audit_log`
  : null;
console.log("\n=== admin_audit_log row count ===");
console.log(auditCount ? auditCount[0].count : "(table missing)");
