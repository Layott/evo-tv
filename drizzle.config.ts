import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema/*",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.POSTGRES_URL_NON_POOLING ??
      process.env.POSTGRES_URL ??
      process.env.DATABASE_URL ??
      "",
  },
  verbose: true,
  strict: true,
} satisfies Config;
