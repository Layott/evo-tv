import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync, readdirSync } from "node:fs";
import crypto from "node:crypto";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
const sql = neon(URL);

const migDir = resolve(__dirname, "..", "db", "migrations");
const journal = JSON.parse(readFileSync(resolve(migDir, "meta", "_journal.json"), "utf8"));
const files = readdirSync(migDir).filter(f => f.endsWith(".sql")).sort();

const diskHashes = files.map(f => {
  const body = readFileSync(resolve(migDir, f), "utf8");
  return { tag: f.replace(".sql", ""), hash: crypto.createHash("sha256").update(body).digest("hex") };
});

const dbRows = await sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`;

console.log("=== disk .sql files vs DB journal hashes ===");
console.log("idx  tag                              disk-hash(8)  db-hash(8)  match  db-id  db-ts");
const journalEntryByTag = Object.fromEntries(journal.entries.map(e => [e.tag, e]));
for (let i = 0; i < diskHashes.length; i++) {
  const d = diskHashes[i];
  const dbRow = dbRows[i];
  const match = dbRow && dbRow.hash === d.hash ? "✓" : (dbRow ? "MISMATCH" : "missing");
  const je = journalEntryByTag[d.tag];
  const tsMs = je ? je.when : null;
  console.log(
    String(i).padStart(3),
    d.tag.padEnd(32),
    d.hash.slice(0, 8),
    " ",
    dbRow ? dbRow.hash.slice(0, 8) : "(none)  ",
    " ",
    match.padEnd(8),
    " ",
    dbRow ? dbRow.id : "-",
    " ",
    tsMs ? new Date(Number(tsMs)).toISOString() : "(no journal entry)",
  );
}

console.log("\n=== summary ===");
console.log("disk .sql files:", diskHashes.length);
console.log("disk journal entries:", journal.entries.length);
console.log("db journal rows:", dbRows.length);
