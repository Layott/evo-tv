import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";

// DATABASE_URL is the one the deployment sets, so it wins. POSTGRES_URL is
// the Vercel Marketplace Neon injection and stays only as a fallback for a
// local .env.local that still carries it.
//
// The order matters more than it looks. It used to be POSTGRES_URL first,
// which meant a droplet .env copied wholesale from `vercel env pull` would
// keep talking to Neon no matter what DATABASE_URL said: the site would work,
// nothing would log, and the migration would look done while every write went
// to the old database.
const DATABASE_URL = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
if (!DATABASE_URL) {
  throw new Error(
    "No DB connection string. Expected DATABASE_URL (self-hosted / manual) " +
      "or POSTGRES_URL. On the droplet this is the DO Managed Postgres pool " +
      "URI on the private VPC host.",
  );
}

declare global {
  // eslint-disable-next-line no-var
  var __evo_sql: ReturnType<typeof postgres> | undefined;
  // eslint-disable-next-line no-var
  var __evo_db: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

/**
 * `prepare: false` is required whenever the connection string points at a
 * transaction-mode pooler (DO Managed Postgres port 25061, PgBouncer, Neon's
 * pooled endpoint). Named prepared statements do not survive a connection
 * being handed to another client mid-session. The cost on a direct connection
 * is one extra parse per query, which is not worth a second code path.
 *
 * TLS is deliberately not set here: postgres-js reads `sslmode` from the
 * connection string, so the URL stays the single source of truth and local
 * development against a plain Postgres needs no special case.
 */
const sql =
  globalThis.__evo_sql ??
  postgres(DATABASE_URL, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

export const db = globalThis.__evo_db ?? drizzle(sql, { schema });

// Cache both across HMR reloads. Caching only `db` would leak a whole
// connection pool on every hot reload, which the old stateless HTTP driver
// could not do.
if (process.env.NODE_ENV !== "production") {
  globalThis.__evo_sql = sql;
  globalThis.__evo_db = db;
}

export { schema, sql };
