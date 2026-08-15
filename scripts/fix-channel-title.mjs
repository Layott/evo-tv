/**
 * fix-channel-title.mjs - one-off, user-requested 2026-06-12.
 * Replaces the em dash in the channel_main title with a colon.
 * Single-row UPDATE, nothing else.
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

const URL =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL;
if (!URL) {
  console.error("no DB URL");
  process.exit(1);
}
const sql = neon(URL);

const before = await sql`SELECT id, title FROM streams WHERE id = 'channel_main'`;
console.log("before:", before[0]?.title ?? "(row missing)");

if (!before[0] || !before[0].title.includes("-")) {
  console.log("no em dash present, nothing to do.");
  process.exit(0);
}

const newTitle = before[0].title.replace(/\s*-\s*/g, ": ");
const updated = await sql`
  UPDATE streams SET title = ${newTitle} WHERE id = 'channel_main' RETURNING id, title`;
console.log("after: ", updated[0]?.title);
