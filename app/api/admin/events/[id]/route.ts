import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  mapSqliteUniqueError,
  requireAdminFromRequest,
  writeAudit,
} from "@/lib/api/admin";

const updateSchema = z
  .object({
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
    teamIds: z.array(z.string().min(1)),
  })
  .partial();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const existing = db
    .select()
    .from(schema.events)
    .where(eq(schema.events.id, id))
    .get();
  if (!existing) return new NextResponse("Event not found", { status: 404 });

  const { teamIds, ...eventPatch } = parsed.data;

  try {
    if (Object.keys(eventPatch).length > 0) {
      db.update(schema.events)
        .set(eventPatch)
        .where(eq(schema.events.id, id))
        .run();
    }
    if (teamIds !== undefined) {
      db.delete(schema.eventTeams)
        .where(eq(schema.eventTeams.eventId, id))
        .run();
      for (const teamId of teamIds) {
        db.insert(schema.eventTeams).values({ eventId: id, teamId }).run();
      }
    }
  } catch (err) {
    const conflict = mapSqliteUniqueError(err);
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }

  const updated = db
    .select()
    .from(schema.events)
    .where(eq(schema.events.id, id))
    .get();
  const currentTeamIds = db
    .select({ teamId: schema.eventTeams.teamId })
    .from(schema.eventTeams)
    .where(eq(schema.eventTeams.eventId, id))
    .all()
    .map((r) => r.teamId);

  writeAudit({
    actorId: guard.user.id,
    action: "update",
    targetType: "event",
    targetId: id,
    meta: parsed.data as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ ...updated, teamIds: currentTeamIds });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = db
    .select()
    .from(schema.events)
    .where(eq(schema.events.id, id))
    .get();
  if (!existing) return new NextResponse("Event not found", { status: 404 });

  try {
    db.delete(schema.events).where(eq(schema.events.id, id)).run();
  } catch {
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }

  writeAudit({
    actorId: guard.user.id,
    action: "delete",
    targetType: "event",
    targetId: id,
    meta: existing as unknown as Record<string, unknown>,
  });

  return new NextResponse(null, { status: 204 });
}
