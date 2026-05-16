import "server-only";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { hasMinRole } from "@/lib/auth/roles";
import { log } from "@/lib/log";

/**
 * POST /api/admin/db/sync-migrations — one-shot drift repair.
 *
 * Admin-only. Idempotent. Creates `daily_quest_claims` if it doesn't exist
 * yet (migration 0017's journal is out of sync due to earlier `party_messages`
 * drift, so `pnpm db:migrate` can't be run from the build pipeline).
 *
 * Reports what it did. Safe to call multiple times — every statement uses
 * IF NOT EXISTS so re-runs are no-ops.
 *
 * After the daily_quest_claims table is verified live, this route should be
 * deleted in a follow-up commit. It is gated to admin role + head_admin only,
 * but principle-of-least-privilege says ship it then remove it.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  if (!hasMinRole(user.role, "admin")) {
    return new NextResponse("Admin only", { status: 403 });
  }

  const actions: string[] = [];

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "daily_quest_claims" (
        "user_id" text NOT NULL,
        "quest_id" text NOT NULL,
        "day_key" text NOT NULL,
        "reward_coins" integer NOT NULL,
        "reward_xp" integer NOT NULL,
        "claimed_at" timestamp DEFAULT now() NOT NULL
      );
    `);
    actions.push("created daily_quest_claims (or already existed)");

    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'daily_quest_claims_user_id_user_id_fk'
        ) THEN
          ALTER TABLE "daily_quest_claims"
            ADD CONSTRAINT "daily_quest_claims_user_id_user_id_fk"
            FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    actions.push("ensured user_id FK");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "daily_quest_claims_user_idx"
        ON "daily_quest_claims" USING btree ("user_id");
    `);
    actions.push("ensured daily_quest_claims_user_idx");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "daily_quest_claims_day_idx"
        ON "daily_quest_claims" USING btree ("day_key");
    `);
    actions.push("ensured daily_quest_claims_day_idx");

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "daily_quest_claims_unique_per_day"
        ON "daily_quest_claims" USING btree ("user_id","quest_id","day_key");
    `);
    actions.push("ensured daily_quest_claims_unique_per_day");

    // ── Phase 9a — pillar columns ─────────────────────────────────────
    // Add `pillar` to channels, streams, vods, clips. NOT NULL with default
    // 'esports' so existing rows backfill safely.
    for (const table of ["channels", "streams", "vods", "clips"]) {
      await db.execute(
        sql.raw(
          `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "pillar" text NOT NULL DEFAULT 'esports'`,
        ),
      );
      actions.push(`ensured ${table}.pillar`);
    }

    log.info("admin.db.sync-migrations.ok", { actorId: user.id, actions });
    return NextResponse.json({ ok: true, actions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn("admin.db.sync-migrations.failed", {
      actorId: user.id,
      error: msg,
      actions,
    });
    return NextResponse.json(
      { ok: false, error: msg, partialActions: actions },
      { status: 500 },
    );
  }
}
