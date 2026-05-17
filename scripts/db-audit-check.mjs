import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
const sql = neon(URL);

const al = await sql`SELECT to_regclass('public.audit_log') AS r`;
console.log("audit_log exists?", al[0].r);
if (al[0].r) {
  const c = await sql`SELECT count(*)::int AS n FROM audit_log`;
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='audit_log'
    ORDER BY ordinal_position`;
  console.log("audit_log rows:", c[0].n);
  console.log("audit_log cols:", cols.map(x => x.column_name).join(", "));
  if (c[0].n > 0) {
    const recent = await sql`SELECT action, target_type, created_at FROM audit_log ORDER BY created_at DESC LIMIT 5`;
    console.log("audit_log recent 5:", recent);
  }
}

const aal = await sql`SELECT to_regclass('public.admin_audit_log') AS r`;
console.log("\nadmin_audit_log exists?", aal[0].r);
if (aal[0].r) {
  const c = await sql`SELECT count(*)::int AS n FROM admin_audit_log`;
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='admin_audit_log'
    ORDER BY ordinal_position`;
  console.log("admin_audit_log rows:", c[0].n);
  console.log("admin_audit_log cols:", cols.map(x => x.column_name).join(", "));
}
