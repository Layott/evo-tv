/**
 * inventory-fake-seeds.ts - READ ONLY.
 *
 * Reports which mock-fixture rows (the exact ids db/seed.ts inserts) still
 * exist in the database, per table. SELECT only, zero writes. Run with:
 *
 *   pnpm tsx scripts/inventory-fake-seeds.ts
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "..", ".env.local") });

import { games } from "../lib/mock/games";
import { teams } from "../lib/mock/teams";
import { players } from "../lib/mock/players";
import { events, matches } from "../lib/mock/events";
import { streams } from "../lib/mock/streams";
import { vods, clips } from "../lib/mock/vods";
import { profiles as mockProfiles } from "../lib/mock/users";
import { subscriptions as mockSubs } from "../lib/mock/subs";
import { products as mockProducts } from "../lib/mock/products";
import { orders as mockOrders } from "../lib/mock/orders";
import { ads as mockAds } from "../lib/mock/ads";
import { notifications as mockNotifs } from "../lib/mock/notifications";
import { polls as mockPolls } from "../lib/mock/polls";

const URL =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL;
if (!URL) {
  console.error("[inventory] no DB URL in env");
  process.exit(1);
}
const sql = neon(URL);

interface Check {
  table: string;
  idColumn: string;
  ids: string[];
  note?: string;
}

const CHECKS: Check[] = [
  { table: "games", idColumn: "id", ids: games.map((g) => g.id) },
  { table: "teams", idColumn: "id", ids: teams.map((t) => t.id) },
  { table: "players", idColumn: "id", ids: players.map((p) => p.id) },
  { table: "events", idColumn: "id", ids: events.map((e) => e.id) },
  { table: "matches", idColumn: "id", ids: matches.map((m) => m.id) },
  { table: "streams", idColumn: "id", ids: streams.map((s) => s.id) },
  { table: "vods", idColumn: "id", ids: vods.map((v) => v.id) },
  { table: "clips", idColumn: "id", ids: clips.map((c) => c.id) },
  {
    table: "user",
    idColumn: "id",
    ids: mockProfiles.map((p) => p.id),
    note: "mock demo accounts",
  },
  {
    table: "subscriptions",
    idColumn: "id",
    ids: mockSubs.map((s) => s.id),
  },
  { table: "products", idColumn: "id", ids: mockProducts.map((p) => p.id) },
  { table: "orders", idColumn: "id", ids: mockOrders.map((o) => o.id) },
  { table: "ads", idColumn: "id", ids: mockAds.map((a) => a.id) },
  {
    table: "notifications",
    idColumn: "id",
    ids: mockNotifs.map((n) => n.id),
  },
  { table: "polls", idColumn: "id", ids: mockPolls.map((p) => p.id) },
];

async function main() {
  console.log("[inventory] READ-ONLY scan for seeded mock rows\n");
  let totalFound = 0;
  for (const check of CHECKS) {
    try {
      const rows = (await sql.query(
        `SELECT "${check.idColumn}" AS id FROM "${check.table}" WHERE "${check.idColumn}" = ANY($1) ORDER BY 1`,
        [check.ids],
      )) as Array<{ id: string }>;
      totalFound += rows.length;
      const flag = rows.length > 0 ? "FAKE ROWS PRESENT" : "clean";
      console.log(
        `${check.table.padEnd(15)} ${String(rows.length).padStart(3)}/${String(check.ids.length).padStart(3)} seeded ids present  [${flag}]${check.note ? ` (${check.note})` : ""}`,
      );
      if (rows.length > 0 && rows.length <= 12) {
        console.log(`                ${rows.map((r) => r.id).join(", ")}`);
      }
    } catch (err) {
      console.log(
        `${check.table.padEnd(15)} ERROR: ${err instanceof Error ? err.message.split("\n")[0] : String(err)}`,
      );
    }
  }
  console.log(`\n[inventory] total seeded mock rows still in DB: ${totalFound}`);
}

void main();
