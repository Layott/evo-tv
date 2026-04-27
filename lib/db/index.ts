import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "@/db/schema";

const DB_PATH = process.env.DATABASE_URL ?? "./data/evo.db";

function connect() {
  fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });
  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");
  return drizzle(sqlite, { schema });
}

declare global {
  // eslint-disable-next-line no-var
  var __evo_db: ReturnType<typeof connect> | undefined;
}

export const db = globalThis.__evo_db ?? connect();
if (process.env.NODE_ENV !== "production") globalThis.__evo_db = db;

export { schema };
