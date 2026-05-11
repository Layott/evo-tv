import "server-only";
import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/db/schema";

// Vercel Marketplace's Neon integration injects POSTGRES_URL (pooled).
// Fall back to DATABASE_URL for non-Vercel dev / migrations.
const DATABASE_URL = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error(
    "No DB connection string. Expected POSTGRES_URL (Vercel Neon integration) " +
      "or DATABASE_URL (manual). Run `vercel install neon` or `vercel env pull` " +
      "in the backend repo.",
  );
}

// Reuse fetch across invocations on edge/serverless runtimes.
neonConfig.fetchConnectionCache = true;

const sql = neon(DATABASE_URL);

declare global {
  // eslint-disable-next-line no-var
  var __evo_db: ReturnType<typeof drizzle<typeof schema>> | undefined;
}

export const db = globalThis.__evo_db ?? drizzle(sql, { schema });
if (process.env.NODE_ENV !== "production") globalThis.__evo_db = db;

export { schema };
