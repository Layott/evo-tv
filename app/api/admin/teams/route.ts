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

  const id = generateId("team");
  try {
    await db.insert(schema.teams).values({ id, ...parsed.data });
  } catch (err) {
    const conflict = mapSqliteUniqueError(err);
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }

  writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "editorial",
    action: "create",
    targetType: "team",
    targetId: id,
    before: null,
    after: { id, ...parsed.data } as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ id, ...parsed.data }, { status: 201 });
}
