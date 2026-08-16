import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";
import {
  CHANNEL_BREAKS_FLAG_KEY,
  readChannelBreaks,
  normalizeChannelBreaks,
} from "@/lib/channel-breaks";
import { writeAudit } from "@/lib/api/audit";

/**
 * GET  /api/admin/channel-breaks - support_admin+. The channel's rhythm.
 * PUT  /api/admin/channel-breaks - support_admin+. Replaces it.
 *
 * Viewers read the same values through `GET /api/channel/breaks`, which also
 * tells them whether their own subscription removes the ads.
 */

export async function GET() {
  const guard = await requireMinRole("support_admin");
  if (!guard.ok) return guard.response;
  return NextResponse.json(await readChannelBreaks());
}

const putSchema = z.object({
  enabled: z.boolean(),
  // Zero is a real value: it turns that one thing off without disabling the
  // rest, which is how you run announcements without ads, or the reverse.
  adIntervalMin: z.number().int().min(0).max(240),
  adMaxSec: z.number().int().min(5).max(180),
  overlayIntervalMin: z.number().int().min(0).max(240),
  overlayDurationSec: z.number().int().min(3).max(60),
  fillerOnDrop: z.boolean(),
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

  const payload = normalizeChannelBreaks(parsed.data) as unknown as Record<
    string,
    unknown
  >;

  await db
    .insert(schema.featureFlags)
    .values({
      key: CHANNEL_BREAKS_FLAG_KEY,
      enabled: true,
      description: "Channel ad breaks, on-air card, and filler when the feed drops",
      payload,
    })
    .onConflictDoUpdate({
      target: schema.featureFlags.key,
      set: { payload, enabled: true },
    });

  await writeAudit({
    actorId: guard.user.id,
    action: "channel.breaks.update",
    targetType: "system",
    targetId: "channel",
    meta: payload,
  });

  return NextResponse.json(payload);
}
