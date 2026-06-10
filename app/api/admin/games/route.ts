import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { asc } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import {
  generateId,
  mapSqliteUniqueError,
  requireAdminFromRequest,
  writeAudit,
} from "@/lib/api/admin";

const createSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  shortName: z.string().min(1).max(50),
  coverUrl: z.string(),
  iconUrl: z.string(),
  category: z.enum(["br", "fps", "moba", "sports", "fighting"]),
  platform: z.enum(["mobile", "pc", "console"]),
  activePlayers: z.number().int().nonnegative(),
  enabled: z.boolean().optional().default(true),
  featured: z.boolean().optional().default(false),
  displayOrder: z.number().int().nonnegative().optional().default(0),
});

export async function GET(_req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const games = await db
    .select()
    .from(schema.games)
    .orderBy(asc(schema.games.displayOrder), asc(schema.games.name));

  return NextResponse.json(games);
}

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

  const id = generateId("game");
  try {
    await db
      .insert(schema.games)
      .values({
        id,
        slug: parsed.data.slug,
        name: parsed.data.name,
        shortName: parsed.data.shortName,
        coverUrl: parsed.data.coverUrl,
        iconUrl: parsed.data.iconUrl,
        category: parsed.data.category,
        platform: parsed.data.platform,
        activePlayers: parsed.data.activePlayers,
        enabled: parsed.data.enabled,
        featured: parsed.data.featured,
        displayOrder: parsed.data.displayOrder,
      });
  } catch (err) {
    const conflict = mapSqliteUniqueError(err);
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to create game" }, { status: 500 });
  }

  writeAudit({
    actorId: guard.user.id,
    action: "create",
    targetType: "game",
    targetId: id,
    meta: parsed.data as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ id, ...parsed.data }, { status: 201 });
}
