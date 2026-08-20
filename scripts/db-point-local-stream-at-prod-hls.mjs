/**
 * Point a local stream row at production's real master playlist.
 *
 * Only so the quality gate can be exercised against a manifest that actually
 * exists, with the four rungs production advertises, rather than a fixture.
 * Local database only: it refuses to run against anything that is not
 * localhost, because rewriting a stream's manifest URL on production would take
 * the channel off the air.
 *
 *   node scripts/db-point-local-stream-at-prod-hls.mjs <streamId> <masterUrl>
 */
import { config } from "dotenv";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const URL_ =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL;

if (!/localhost|127\.0\.0\.1/.test(URL_)) {
  console.error("Refusing to run: DATABASE_URL is not local.");
  process.exit(1);
}

const [streamId, masterUrl] = process.argv.slice(2);
if (!streamId || !masterUrl) {
  console.error("usage: node scripts/db-point-local-stream-at-prod-hls.mjs <streamId> <masterUrl>");
  process.exit(1);
}

const sql = postgres(URL_, { max: 1 });
const rows = await sql`
  UPDATE streams SET hls_path = ${masterUrl}, is_live = true
  WHERE id = ${streamId}
  RETURNING id, hls_path`;
console.log(rows[0] ?? "no such stream");
await sql.end();
