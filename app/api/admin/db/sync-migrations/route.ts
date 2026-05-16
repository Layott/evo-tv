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

    // ── Phase 9b — Shows / Seasons / Episodes ─────────────────────────
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "shows" (
        "id" text PRIMARY KEY,
        "slug" text NOT NULL UNIQUE,
        "title" text NOT NULL,
        "synopsis" text NOT NULL DEFAULT '',
        "hero_url" text NOT NULL DEFAULT '',
        "poster_url" text NOT NULL DEFAULT '',
        "pillar" text NOT NULL DEFAULT 'esports',
        "origin_type" text NOT NULL DEFAULT 'evo_original',
        "status" text NOT NULL DEFAULT 'upcoming',
        "primary_creator_handle" text NOT NULL DEFAULT '',
        "total_seasons" integer NOT NULL DEFAULT 0,
        "total_episodes" integer NOT NULL DEFAULT 0,
        "rating" double precision NOT NULL DEFAULT 0,
        "released_at" timestamp,
        "tags" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "deleted_at" timestamp
      );
    `);
    actions.push("ensured shows");

    await db.execute(sql`CREATE INDEX IF NOT EXISTS "shows_pillar_idx" ON "shows" ("pillar");`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "shows_status_idx" ON "shows" ("status");`);
    actions.push("ensured shows indexes");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "seasons" (
        "id" text PRIMARY KEY,
        "show_id" text NOT NULL,
        "season_number" integer NOT NULL,
        "title" text NOT NULL DEFAULT '',
        "episode_count" integer NOT NULL DEFAULT 0,
        "released_at" timestamp
      );
    `);
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'seasons_show_id_fk'
        ) THEN
          ALTER TABLE "seasons" ADD CONSTRAINT "seasons_show_id_fk"
            FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "seasons_show_idx" ON "seasons" ("show_id");`);
    actions.push("ensured seasons");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "episodes" (
        "id" text PRIMARY KEY,
        "show_id" text NOT NULL,
        "season_id" text NOT NULL,
        "season_number" integer NOT NULL,
        "episode_number" integer NOT NULL,
        "title" text NOT NULL,
        "synopsis" text NOT NULL DEFAULT '',
        "thumbnail_url" text NOT NULL DEFAULT '',
        "runtime_sec" integer NOT NULL DEFAULT 0,
        "hls_url" text NOT NULL DEFAULT '',
        "intro_start_sec" integer,
        "intro_end_sec" integer,
        "premiere_at" timestamp,
        "released_at" timestamp,
        "deleted_at" timestamp
      );
    `);
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'episodes_show_id_fk'
        ) THEN
          ALTER TABLE "episodes" ADD CONSTRAINT "episodes_show_id_fk"
            FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'episodes_season_id_fk'
        ) THEN
          ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_fk"
            FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "episodes_lookup_idx" ON "episodes" ("show_id","season_number","episode_number");`);
    actions.push("ensured episodes");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "episode_progress" (
        "user_id" text NOT NULL,
        "episode_id" text NOT NULL,
        "position_sec" integer NOT NULL DEFAULT 0,
        "completed_at" timestamp,
        "updated_at" timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY ("user_id","episode_id")
      );
    `);
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'episode_progress_user_fk'
        ) THEN
          ALTER TABLE "episode_progress" ADD CONSTRAINT "episode_progress_user_fk"
            FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'episode_progress_episode_fk'
        ) THEN
          ALTER TABLE "episode_progress" ADD CONSTRAINT "episode_progress_episode_fk"
            FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    actions.push("ensured episode_progress");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "show_watchlist" (
        "user_id" text NOT NULL,
        "show_id" text NOT NULL,
        "status" text NOT NULL DEFAULT 'watching',
        "added_at" timestamp NOT NULL DEFAULT now(),
        PRIMARY KEY ("user_id","show_id")
      );
    `);
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'show_watchlist_user_fk'
        ) THEN
          ALTER TABLE "show_watchlist" ADD CONSTRAINT "show_watchlist_user_fk"
            FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE CASCADE;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'show_watchlist_show_fk'
        ) THEN
          ALTER TABLE "show_watchlist" ADD CONSTRAINT "show_watchlist_show_fk"
            FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE CASCADE;
        END IF;
      END $$;
    `);
    actions.push("ensured show_watchlist");

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
