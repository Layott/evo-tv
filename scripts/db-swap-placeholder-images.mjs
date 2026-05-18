import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const URL =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL;
const sql = neon(URL);

/**
 * Swap relative placeholder image paths (e.g. "/esports-championship-winning-moment.jpg")
 * for real CDN URLs. Anywhere a media column value starts with "/", is empty,
 * or contains "placeholder" gets rewritten to a deterministic picsum.photos
 * (posters) or dicebear (avatars) URL seeded by id+column.
 */

const picsum = (seed, w = 1280, h = 720) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

const dicebearAvatar = (seed) =>
  `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}`;

function isPlaceholder(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  return (
    value.length === 0 ||
    value.startsWith("/") ||
    value.includes("placeholder") ||
    value.includes("/demo/")
  );
}

async function tableHasColumn(table, col) {
  const rows = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${table} AND column_name=${col}
    LIMIT 1`;
  return rows.length > 0;
}

async function tableExists(table) {
  const rows = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name=${table}
    LIMIT 1`;
  return rows.length > 0;
}

async function swapColumn(table, idCol, col, build) {
  if (!(await tableExists(table))) {
    console.log(`${table}: missing, skip`);
    return;
  }
  if (!(await tableHasColumn(table, col))) {
    console.log(`${table}.${col}: missing, skip`);
    return;
  }
  const sel = `SELECT ${idCol} AS id, ${col} AS val FROM ${table}`;
  const rows = await sql.query(sel);
  let updated = 0;
  for (const row of rows) {
    if (!isPlaceholder(row.val)) continue;
    const next = build(`${row.id}:${col}`);
    const upd = `UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`;
    await sql.query(upd, [next, row.id]);
    updated += 1;
  }
  console.log(`${table}.${col}: ${updated}/${rows.length}`);
}

const poster = (w, h) => (s) => picsum(s, w, h);
const avatar = () => (s) => dicebearAvatar(s);

await swapColumn("events", "id", "banner_url", poster(1600, 600));
await swapColumn("events", "id", "thumbnail_url", poster(800, 450));

await swapColumn("streams", "id", "thumbnail_url", poster(1280, 720));
await swapColumn("streams", "id", "streamer_avatar_url", avatar());

await swapColumn("vods", "id", "thumbnail_url", poster(1280, 720));

await swapColumn("clips", "id", "thumbnail_url", poster(720, 1280));
await swapColumn("clips", "id", "creator_avatar_url", avatar());

await swapColumn("episodes", "id", "thumbnail_url", poster(1280, 720));

await swapColumn("channels", "id", "cover_url", poster(1600, 400));
await swapColumn("channels", "id", "avatar_url", avatar());
await swapColumn("channels", "id", "logo_url", avatar());

await swapColumn("shows", "id", "cover_url", poster(1600, 600));
await swapColumn("shows", "id", "banner_url", poster(1600, 600));
await swapColumn("shows", "id", "thumbnail_url", poster(800, 1200));

await swapColumn("products", "id", "image_url", poster(800, 800));

await swapColumn("teams", "id", "logo_url", avatar());

await swapColumn("players", "id", "avatar_url", avatar());

await swapColumn("games", "id", "cover_url", poster(800, 1200));
await swapColumn("games", "id", "icon_url", avatar());

console.log("done.");
