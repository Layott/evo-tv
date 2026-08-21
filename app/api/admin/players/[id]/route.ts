import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  mapSqliteUniqueError,
  requireCapability,
  writeAudit,
} from "@/lib/api/admin";
import { foreignKeyViolationResponse } from "@/lib/api/catalog-guards";

const updateSchema = z
  .object({
    handle: z.string().min(1).max(100),
    realName: z.string().min(1).max(200),
    avatarUrl: z.string(),
    teamId: z.string().min(1).nullable(),
    gameId: z.string().min(1),
    role: z.string().min(1).max(50),
    country: z.string().min(1).max(50),
    kda: z.number().nonnegative(),
    followers: z.number().int().nonnegative(),
  })
  .partial();

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability("editorial");
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

  const existing = (
    await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.id, id))
      .limit(1)
  )[0];
  if (!existing) return new NextResponse("Player not found", { status: 404 });

  const patch: Partial<typeof schema.players.$inferInsert> = {};
  if (parsed.data.handle !== undefined) patch.handle = parsed.data.handle;
  if (parsed.data.realName !== undefined) patch.realName = parsed.data.realName;
  if (parsed.data.avatarUrl !== undefined) patch.avatarUrl = parsed.data.avatarUrl;
  if (parsed.data.teamId !== undefined) patch.teamId = parsed.data.teamId;
  if (parsed.data.gameId !== undefined) patch.gameId = parsed.data.gameId;
  if (parsed.data.role !== undefined) patch.role = parsed.data.role;
  if (parsed.data.country !== undefined) patch.country = parsed.data.country;
  if (parsed.data.kda !== undefined) patch.kda = Math.round(parsed.data.kda * 100);
  if (parsed.data.followers !== undefined) patch.followers = parsed.data.followers;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(existing);
  }

  try {
    await db.update(schema.players).set(patch).where(eq(schema.players.id, id));
  } catch (err) {
    const conflict = mapSqliteUniqueError(err);
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to update player" }, { status: 500 });
  }

  const updated = (
    await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.id, id))
      .limit(1)
  )[0];

  writeAudit({
    before: existing as unknown as Record<string, unknown>,
    after: updated as unknown as Record<string, unknown>,
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "editorial",
    action: "update",
    targetType: "player",
    targetId: id,
    meta: parsed.data as Record<string, unknown>,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireCapability("editorial");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const existing = (
    await db
      .select()
      .from(schema.players)
      .where(eq(schema.players.id, id))
      .limit(1)
  )[0];
  if (!existing) return new NextResponse("Player not found", { status: 404 });

  try {
    await db.delete(schema.players).where(eq(schema.players.id, id));
  } catch (err) {
    // Rows elsewhere still referencing this one make Postgres refuse. That is
    // a 409 an operator can act on, not the 500 it used to become.
    const conflict = foreignKeyViolationResponse(err, "player");
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to delete player" }, { status: 500 });
  }

  writeAudit({
    before: existing as unknown as Record<string, unknown>,
    after: null,
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "editorial",
    action: "delete",
    targetType: "player",
    targetId: id,
    meta: existing as unknown as Record<string, unknown>,
  });

  return new NextResponse(null, { status: 204 });
}
