import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const URL =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL;
const sql = neon(URL);

const sqlText = readFileSync(
  resolve(__dirname, "..", "db", "migrations", "0021_creator_applications.sql"),
  "utf8",
);

const exists = await sql`SELECT to_regclass('public.creator_applications') AS r`;
if (exists[0].r) {
  console.log("creator_applications exists — skipping CREATE block");
} else {
  console.log("applying 0021_creator_applications.sql…");
  const statements = sqlText
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log("applied " + statements.length + " statements");
}

const hash = crypto.createHash("sha256").update(sqlText).digest("hex");
const ts = 1779062000000;
const already = await sql`SELECT id FROM drizzle.__drizzle_migrations WHERE hash = ${hash}`;
if (already.length > 0) {
  console.log("journal already has 0021 row");
} else {
  await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${ts})`;
  console.log("inserted journal row for 0021");
}
