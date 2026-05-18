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

for (const t of ["streams", "vods", "clips", "episodes"]) {
  const cols = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name=${t}
      AND (column_name LIKE '%hls%' OR column_name LIKE '%mp4%' OR column_name LIKE '%url%' OR column_name LIKE '%path%')
    ORDER BY ordinal_position`;
  console.log(t, "→", cols.map((c) => c.column_name).join(", "));
}
