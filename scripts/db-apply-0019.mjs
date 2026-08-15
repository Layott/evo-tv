import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
const sql = neon(URL);

const exists = await sql`SELECT to_regclass('public.expo_push_tokens') AS r`;
if (exists[0].r) {
  console.log("expo_push_tokens already exists - skipping CREATE");
} else {
  console.log("creating expo_push_tokens…");
  await sql`CREATE TABLE "expo_push_tokens" (
    "token" text PRIMARY KEY NOT NULL,
    "user_id" text NOT NULL,
    "platform" text NOT NULL,
    "created_at" text NOT NULL,
    "last_seen_at" text NOT NULL
  )`;
  await sql`ALTER TABLE "expo_push_tokens" ADD CONSTRAINT "expo_push_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action`;
  await sql`CREATE INDEX "expo_push_user_idx" ON "expo_push_tokens" USING btree ("user_id")`;
  console.log("table created");
}

const body = readFileSync(resolve(__dirname, "..", "db", "migrations", "0019_expo_push_tokens.sql"), "utf8");
const hash = crypto.createHash("sha256").update(body).digest("hex");
const journalTs = 1779054000000;
const already = await sql`SELECT id FROM drizzle.__drizzle_migrations WHERE hash = ${hash}`;
if (already.length > 0) {
  console.log("journal already has 0019 row");
} else {
  await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${journalTs})`;
  console.log("inserted journal row for 0019");
}

const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='expo_push_tokens' ORDER BY ordinal_position`;
console.log("final cols:", cols.map(c => c.column_name).join(", "));
