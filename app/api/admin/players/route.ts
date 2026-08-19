import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import {
  generateId,
  mapSqliteUniqueError,
  requireCapability,
  writeAudit,
} from "@/lib/api/admin";

const createSchema = z.object({
  handle: z.string().min(1).max(100),
  realName: z.string().min(1).max(200),
  avatarUrl: z.string(),
  teamId: z.string().min(1).nullable().optional(),
  gameId: z.string().min(1),
  role: z.string().min(1).max(50),
  country: z.string().min(1).max(50),
  kda: z.number().nonnegative(),
  followers: z.number().int().nonnegative(),
});

export async function POST(req: NextRequest) {
  const guard = await requireCapability("editorial");
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

  const id = generateId("player");
  const { kda, teamId, ...rest } = parsed.data;
  try {
    await db
      .insert(schema.players)
      .values({
        id,
        ...rest,
        teamId: teamId ?? null,
        kda: Math.round(kda * 100),
      });
  } catch (err) {
    const conflict = mapSqliteUniqueError(err);
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to create player" }, { status: 500 });
  }

  writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "editorial",
    action: "create",
    targetType: "player",
    targetId: id,
    meta: parsed.data as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ id, ...parsed.data }, { status: 201 });
}
