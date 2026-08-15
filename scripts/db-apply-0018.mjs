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

const exists = await sql`SELECT to_regclass('public.vod_bookmarks') AS r`;
if (exists[0].r) {
  console.log("vod_bookmarks already exists - skipping CREATE");
} else {
  console.log("creating vod_bookmarks…");
  await sql`CREATE TABLE "vod_bookmarks" (
    "user_id" text NOT NULL,
    "vod_id" text NOT NULL,
    "created_at" text NOT NULL
  )`;
  await sql`ALTER TABLE "vod_bookmarks" ADD CONSTRAINT "vod_bookmarks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action`;
  await sql`ALTER TABLE "vod_bookmarks" ADD CONSTRAINT "vod_bookmarks_vod_id_vods_id_fk" FOREIGN KEY ("vod_id") REFERENCES "public"."vods"("id") ON DELETE cascade ON UPDATE no action`;
  await sql`ALTER TABLE "vod_bookmarks" ADD CONSTRAINT "vod_bookmarks_user_id_vod_id_pk" PRIMARY KEY ("user_id","vod_id")`;
  await sql`CREATE INDEX "vod_bookmarks_user_idx" ON "vod_bookmarks" USING btree ("user_id","created_at")`;
  console.log("table created");
}

const body = readFileSync(resolve(__dirname, "..", "db", "migrations", "0018_watch_later.sql"), "utf8");
const hash = crypto.createHash("sha256").update(body).digest("hex");
const journalTs = 1779046000000;
const already = await sql`SELECT id FROM drizzle.__drizzle_migrations WHERE hash = ${hash}`;
if (already.length > 0) {
  console.log("journal already has 0018 row");
} else {
  await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${hash}, ${journalTs})`;
  console.log("inserted journal row for 0018");
}

const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='vod_bookmarks' ORDER BY ordinal_position`;
console.log("final cols:", cols.map(c => c.column_name).join(", "));
