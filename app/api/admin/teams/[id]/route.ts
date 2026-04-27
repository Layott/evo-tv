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
    name: z.string().min(1).max(200),
    tag: z.string().min(1).max(20),
    logoUrl: z.string(),
    country: z.string().min(1).max(50),
    region: z.string().min(1).max(50),
    gameId: z.string().min(1),
    ranking: z.number().int(),
    followers: z.number().int().nonnegative(),
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
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
    .from(schema.teams)
    .where(eq(schema.teams.id, id))
    .get();
  if (!existing) return new NextResponse("Team not found", { status: 404 });

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(existing);
  }

  try {
    db.update(schema.teams).set(parsed.data).where(eq(schema.teams.id, id)).run();
  } catch (err) {
    const conflict = mapSqliteUniqueError(err);
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to update team" }, { status: 500 });
  }

  const updated = db
    .select()
    .from(schema.teams)
    .where(eq(schema.teams.id, id))
    .get();

  writeAudit({
    actorId: guard.user.id,
    action: "update",
    targetType: "team",
    targetId: id,
    meta: parsed.data as Record<string, unknown>,
  });

  return NextResponse.json(updated);
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
    .from(schema.teams)
    .where(eq(schema.teams.id, id))
    .get();
  if (!existing) return new NextResponse("Team not found", { status: 404 });

  try {
    db.delete(schema.teams).where(eq(schema.teams.id, id)).run();
  } catch {
    return NextResponse.json({ error: "Failed to delete team" }, { status: 500 });
  }

  writeAudit({
    actorId: guard.user.id,
    action: "delete",
    targetType: "team",
    targetId: id,
    meta: existing as unknown as Record<string, unknown>,
  });

  return new NextResponse(null, { status: 204 });
}
