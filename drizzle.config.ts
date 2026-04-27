import type { Config } from "drizzle-kit";

export default {
  schema: "./db/schema/*",
  out: "./db/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "./data/evo.db",
  },
  verbose: true,
  strict: true,
} satisfies Config;
