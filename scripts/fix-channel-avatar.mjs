/**
 * fix-channel-avatar.mjs - one-off, follows the 2026-06-12 content purge.
 * channel_main.streamer_avatar_url still points at a dicebear placeholder;
 * swap it for the real EVO logo. Single-row UPDATE, nothing else.
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

const LOGO = "https://evo-tv.vercel.app/evo-logo/evo-tv-152.png";

const before = await sql`
  SELECT streamer_avatar_url FROM streams WHERE id = 'channel_main'`;
console.log("before:", before[0]?.streamer_avatar_url ?? "(row missing)");

if (!before[0] || !before[0].streamer_avatar_url.includes("dicebear")) {
  console.log("no dicebear avatar present, nothing to do.");
  process.exit(0);
}

const updated = await sql`
  UPDATE streams SET streamer_avatar_url = ${LOGO}
  WHERE id = 'channel_main' RETURNING streamer_avatar_url`;
console.log("after: ", updated[0]?.streamer_avatar_url);
