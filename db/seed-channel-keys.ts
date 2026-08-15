/**
 * Phase 3.5 one-time seed: generate one stream key per channel that doesn't
 * have an active key yet. Plaintext keys are printed to stdout - copy them
 * out of the run log if EVO needs to publish RTMP from OBS without going
 * through the partner UI yet. After this runs, every channel can be
 * authenticated via channel_stream_keys.
 *
 * Run: `cp .env.local .env && pnpm tsx db/seed-channel-keys.ts && rm .env`
 *
 * Idempotent: skips channels that already have an active key.
 */

import "dotenv/config";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq } from "drizzle-orm";
import crypto from "node:crypto";

import * as schema from "./schema";

const DATABASE_URL =
  // Direct connection first, pooled second, and the DO names ahead of the
  // Vercel ones in each pair. Migrations and seeds must not run through a
  // transaction pooler: DDL and named prepared statements do not survive a
  // connection being handed to another client mid-session.
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING ??
  process.env.DATABASE_URL ??
  process.env.POSTGRES_URL;

if (!DATABASE_URL) {
  console.error("[seed-keys] No DB connection string in env.");
  process.exit(1);
}

const SECRET = process.env.AUTH_SECRET ?? "dev_stream_key_secret";

function generateStreamKey(): string {
  const bytes = crypto.randomBytes(16).toString("hex");
  return `sk_live_${bytes}`;
}

function hashStreamKey(key: string): string {
  return crypto.createHmac("sha256", SECRET).update(key).digest("hex");
}

function genId(prefix: string): string {
  return (
    prefix +
    "_" +
    crypto.randomBytes(8).toString("hex")
  );
}

const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql, { schema });

async function main(): Promise<void> {
  console.log("=== Phase 3.5 seed channel stream keys ===");
  const channels = await db.select().from(schema.channels);
  console.log(`[seed-keys] Found ${channels.length} channels.`);

  for (const ch of channels) {
    const active = (
      await db
        .select({ id: schema.channelStreamKeys.id })
        .from(schema.channelStreamKeys)
        .where(
          and(
            eq(schema.channelStreamKeys.channelId, ch.id),
            eq(schema.channelStreamKeys.active, true),
          ),
        )
        .limit(1)
    )[0];

    if (active) {
      console.log(`[seed-keys]   ${ch.id} already has active key ${active.id}, skipping.`);
      continue;
    }

    const plaintext = generateStreamKey();
    const keyHash = hashStreamKey(plaintext);
    const rowId = genId("csk");
    await db.insert(schema.channelStreamKeys).values({
      id: rowId,
      channelId: ch.id,
      keyHash,
      active: true,
    });

    console.log(`[seed-keys]   ${ch.id.padEnd(28)}  KEY=${plaintext}`);
  }
  console.log("=== seed complete ===");
  console.log(
    "Save these plaintext keys somewhere safe. They cannot be recovered (only their HMAC-SHA256 hash is persisted).",
  );
}

main()
  .catch((err) => {
    console.error("[seed-keys] FAILED", err);
    process.exitCode = 1;
  })
  // postgres-js holds an open socket, so without this the process never exits.
  .finally(() => sql.end({ timeout: 5 }));
