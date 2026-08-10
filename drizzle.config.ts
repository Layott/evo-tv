import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema/*",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    // Direct connection first, pooled second, DO names ahead of the Vercel
    // ones in each pair. Same order as db/migrate.ts, for the same reason:
    // drizzle-kit issues DDL, which must not run through a transaction pooler.
    //
    // The order is the whole point. With POSTGRES_URL first, a `drizzle-kit
    // push` on a machine that still has a Vercel env file would apply schema
    // changes to Neon while every other tool talked to DigitalOcean.
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.DATABASE_URL ??
      process.env.POSTGRES_URL ??
      "",
  },
  verbose: true,
  strict: true,
} satisfies Config;
