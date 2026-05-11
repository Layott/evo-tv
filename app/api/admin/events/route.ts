import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  generateId,
  mapSqliteUniqueError,
  requireAdminFromRequest,
  writeAudit,
} from "@/lib/api/admin";

const createSchema = z.object({
  slug: z.string().min(1).max(100),
  title: z.string().min(1).max(300),
  gameId: z.string().min(1),
  startsAt: z.string().min(1),
  endsAt: z.string().min(1),
  status: z.enum(["scheduled", "live", "completed", "cancelled"]),
  tier: z.enum(["s", "a", "b", "c"]),
  bannerUrl: z.string(),
  thumbnailUrl: z.string(),
  description: z.string(),
  prizePoolNgn: z.number().int().nonnegative(),
  region: z.string().min(1).max(50),
  format: z.string(),
  teamIds: z.array(z.string().min(1)).default([]),
});

export async function POST(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const id = generateId("event");
  const { teamIds, ...eventData } = parsed.data;

  try {
    await db
      .insert(schema.events)
      .values({
        id,
        ...eventData,
      });
    if (teamIds.length > 0) {
      for (const teamId of teamIds) {
        await db.insert(schema.eventTeams).values({ eventId: id, teamId });
      }
    }
  } catch (err) {
    const conflict = mapSqliteUniqueError(err);
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }

  writeAudit({
    actorId: guard.user.id,
    action: "create",
    targetType: "event",
    targetId: id,
    meta: parsed.data as unknown as Record<string, unknown>,
  });

  const created = (
    await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, id))
      .limit(1)
  )[0];

  return NextResponse.json({ ...created, teamIds }, { status: 201 });
}
