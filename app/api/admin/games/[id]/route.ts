import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  mapSqliteUniqueError,
  requireAdminFromRequest,
  writeAudit,
} from "@/lib/api/admin";
import {
  blockedByDependents,
  foreignKeyViolationResponse,
  gameDependents,
} from "@/lib/api/catalog-guards";

const updateSchema = z
  .object({
    slug: z.string().min(1).max(100),
    name: z.string().min(1).max(200),
    shortName: z.string().min(1).max(50),
    coverUrl: z.string(),
    iconUrl: z.string(),
    category: z.enum(["br", "fps", "moba", "sports", "fighting"]),
    platform: z.enum(["mobile", "pc", "console"]),
    activePlayers: z.number().int().nonnegative(),
    enabled: z.boolean(),
    featured: z.boolean(),
    displayOrder: z.number().int().nonnegative(),
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

  const existing = (
    await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.id, id))
      .limit(1)
  )[0];
  if (!existing) return new NextResponse("Game not found", { status: 404 });

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(existing);
  }

  try {
    await db.update(schema.games).set(parsed.data).where(eq(schema.games.id, id));
  } catch (err) {
    const conflict = mapSqliteUniqueError(err);
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to update game" }, { status: 500 });
  }

  const updated = (
    await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.id, id))
      .limit(1)
  )[0];

  writeAudit({
    actorId: guard.user.id,
    action: "update",
    targetType: "game",
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
  const existing = (
    await db
      .select()
      .from(schema.games)
      .where(eq(schema.games.id, id))
      .limit(1)
  )[0];
  if (!existing) return new NextResponse("Game not found", { status: 404 });

  // `vods.game_id` and `clips.game_id` are ON DELETE CASCADE, so without this
  // deleting a game silently destroys every recording and clip filed under it.
  const blocked = blockedByDependents("game", await gameDependents(id));
  if (blocked) return blocked;

  try {
    await db.delete(schema.games).where(eq(schema.games.id, id));
  } catch (err) {
    const conflict = foreignKeyViolationResponse(err, "game");
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to delete game" }, { status: 500 });
  }

  writeAudit({
    actorId: guard.user.id,
    action: "delete",
    targetType: "game",
    targetId: id,
    meta: existing as unknown as Record<string, unknown>,
  });

  return new NextResponse(null, { status: 204 });
}
