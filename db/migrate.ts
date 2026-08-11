import "../scripts/_env";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

// Migrations need a direct (non-pooled) connection. DDL under a transaction
// pooler can land on a different backend mid-migration.
const DATABASE_URL =
  // Direct connection first, pooled second, and the DO names ahead of the
  // Vercel ones in each pair. Migrations and seeds must not run through a
  // transaction pooler: DDL and named prepared statements do not survive a
  // connection being handed to another client mid-session.
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;
if (!DATABASE_URL) {
  console.error("[migrate] No DB URL found (POSTGRES_URL_NON_POOLING / POSTGRES_URL / DATABASE_URL)");
  process.exit(1);
}

// max: 1 so migrations run strictly in order on one backend.
const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql);

(async () => {
  await migrate(db, { migrationsFolder: "./db/migrations" });
  console.log(`[migrate] applied migrations to ${DATABASE_URL.replace(/:[^:@/]+@/, ":***@")}`);
})()
  .catch((err) => {
    console.error("[migrate] failed", err);
    process.exitCode = 1;
  })
  // postgres-js holds an open socket, so without this the process never exits.
  .finally(() => sql.end({ timeout: 5 }));
