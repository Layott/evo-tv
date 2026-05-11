import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

// Migrations need direct (non-pooled) connection.
const DATABASE_URL =
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.POSTGRES_URL ??
  process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("[migrate] No DB URL found (POSTGRES_URL_NON_POOLING / POSTGRES_URL / DATABASE_URL)");
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const db = drizzle(sql);

(async () => {
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log(`[migrate] applied migrations to ${DATABASE_URL.replace(/:[^:@/]+@/, ":***@")}`);
})().catch((err) => {
  console.error("[migrate] failed", err);
  process.exit(1);
});
