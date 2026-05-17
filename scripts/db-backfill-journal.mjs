import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import crypto from "node:crypto";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const DRY = process.argv.includes("--dry");
const URL = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
const sql = neon(URL);

const migDir = resolve(__dirname, "..", "db", "migrations");
const journalPath = resolve(migDir, "meta", "_journal.json");
const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const files = readdirSync(migDir).filter(f => f.endsWith(".sql")).sort();

const byTagJournalEntry = Object.fromEntries(journal.entries.map(e => [e.tag, e]));

const dbRows = await sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`;
const dbHashes = new Set(dbRows.map(r => r.hash));
const lastDbTs = dbRows.length ? Number(dbRows[dbRows.length - 1].created_at) : 0;
console.log("last DB journal ts:", new Date(lastDbTs).toISOString());

const newDiskEntries = [];
const dbInserts = [];

let nextIdx = journal.entries.length ? Math.max(...journal.entries.map(e => e.idx)) + 1 : 0;

for (const f of files) {
  const tag = f.replace(".sql", "");
  const body = readFileSync(resolve(migDir, f), "utf8");
  const hash = crypto.createHash("sha256").update(body).digest("hex");
  let ts;
  const journalEntry = byTagJournalEntry[tag];
  if (journalEntry) {
    ts = journalEntry.when;
  } else {
    ts = statSync(resolve(migDir, f)).mtimeMs;
    newDiskEntries.push({ idx: nextIdx++, version: "7", when: Math.floor(ts), tag, breakpoints: true });
  }
  if (!dbHashes.has(hash)) {
    dbInserts.push({ tag, hash, createdAt: Math.floor(ts) });
  }
}

console.log("\n=== plan ===");
console.log("Disk journal new entries to add:", newDiskEntries.length);
for (const e of newDiskEntries) console.log("  +", e.idx, e.tag, new Date(e.when).toISOString());
console.log("DB journal rows to insert:", dbInserts.length);
for (const r of dbInserts) console.log("  +", r.tag, r.hash.slice(0, 12), new Date(r.createdAt).toISOString());

if (DRY) {
  console.log("\n(dry run — no writes)");
  process.exit(0);
}

if (newDiskEntries.length) {
  journal.entries = [...journal.entries, ...newDiskEntries];
  writeFileSync(journalPath, JSON.stringify(journal, null, 2) + "\n");
  console.log("\nwrote", journalPath);
}

for (const r of dbInserts) {
  await sql`INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES (${r.hash}, ${r.createdAt})`;
  console.log("  inserted", r.tag);
}

const after = await sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`;
console.log("\nDB journal now has", after.length, "rows");
