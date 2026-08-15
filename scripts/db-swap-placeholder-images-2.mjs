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

const picsum = (seed, w, h) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

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

async function swap(table, idCol, col, w, h) {
  const sel = `SELECT ${idCol} AS id, ${col} AS val FROM ${table}`;
  const rows = await sql.query(sel);
  let updated = 0;
  for (const row of rows) {
    if (!isPlaceholder(row.val)) continue;
    const next = picsum(`${row.id}:${col}`, w, h);
    await sql.query(`UPDATE ${table} SET ${col} = $1 WHERE ${idCol} = $2`, [next, row.id]);
    updated += 1;
  }
  console.log(`${table}.${col}: ${updated}/${rows.length}`);
}

await swap("channels", "id", "banner_url", 1600, 400);
await swap("shows", "id", "hero_url", 1600, 600);
await swap("shows", "id", "poster_url", 800, 1200);

// Products use jsonb `images` array - handle separately
const productRows = await sql`SELECT id, images FROM products`;
let pUpdated = 0;
for (const r of productRows) {
  const imgs = r.images;
  if (!Array.isArray(imgs) || imgs.length === 0) continue;
  const allPlaceholder = imgs.every(isPlaceholder);
  if (!allPlaceholder) continue;
  const fresh = imgs.map((_, i) => picsum(`${r.id}:img${i}`, 800, 800));
  await sql`UPDATE products SET images = ${JSON.stringify(fresh)}::jsonb WHERE id = ${r.id}`;
  pUpdated += 1;
}
console.log(`products.images: ${pUpdated}/${productRows.length}`);

console.log("done.");
