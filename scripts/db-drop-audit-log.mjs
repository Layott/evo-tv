import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
const sql = neon(URL);

const exists = await sql`SELECT to_regclass('public.admin_audit_log') AS reg`;
if (!exists[0].reg) {
  console.log("admin_audit_log already gone");
  process.exit(0);
}
const c = await sql`SELECT count(*)::int AS n FROM admin_audit_log`;
console.log("rows:", c[0].n);
if (c[0].n > 0) {
  console.error("ABORT — admin_audit_log not empty");
  process.exit(1);
}
await sql`DROP TABLE admin_audit_log`;
const after = await sql`SELECT to_regclass('public.admin_audit_log') AS reg`;
console.log("dropped. now:", after[0].reg);
