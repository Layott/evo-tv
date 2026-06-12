import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import {
  PLAYOUT_CONFIG_FLAG_KEY,
  readPlayoutConfig,
} from "@/lib/playout-config";

/**
 * GET  /api/admin/playout-config  - support_admin+. Returns the config.
 * PUT  /api/admin/playout-config  - support_admin+. Replaces the config.
 *
 * The office adapter receives the same config via
 * GET /api/internal/playout-resolve (fillerFiles + adFiles fields).
 */

export async function GET() {
  const guard = await requireMinRole("support_admin");
  if (!guard.ok) return guard.response;
  try {
    return NextResponse.json(await readPlayoutConfig());
  } catch {
    return NextResponse.json({ fillerFiles: [], adFiles: [] });
  }
}

const putSchema = z.object({
  fillerFiles: z.array(z.string().min(1).max(1000)).max(100),
  adFiles: z.array(z.string().min(1).max(1000)).max(100),
});

export async function PUT(req: NextRequest) {
  const guard = await requireMinRole("support_admin");
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const payload: Record<string, unknown> = {
    fillerFiles: parsed.data.fillerFiles,
    adFiles: parsed.data.adFiles,
  };

  await db
    .insert(schema.featureFlags)
    .values({
      key: PLAYOUT_CONFIG_FLAG_KEY,
      enabled: true,
      description: "Linear channel playout: filler content + ad break media",
      payload,
    })
    .onConflictDoUpdate({
      target: schema.featureFlags.key,
      set: { payload, enabled: true },
    });

  return NextResponse.json(parsed.data);
}
