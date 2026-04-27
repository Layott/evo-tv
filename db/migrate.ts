import "dotenv/config";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";

const DB_PATH = process.env.DATABASE_URL ?? "./data/evo.db";
fs.mkdirSync(path.dirname(path.resolve(DB_PATH)), { recursive: true });
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

migrate(db, { migrationsFolder: "./db/migrations" });
console.log(`[migrate] applied migrations to ${DB_PATH}`);
sqlite.close();
