import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import {
  generateId,
  mapSqliteUniqueError,
  requireAdminFromRequest,
  writeAudit,
} from "@/lib/api/admin";

const createSchema = z.object({
  placement: z.enum(["home_banner", "stream_preroll", "sidebar", "between_content"]),
  mediaUrl: z.string(),
  clickUrl: z.string(),
  advertiser: z.string().min(1).max(200),
  active: z.boolean(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  weight: z.number().int().nonnegative(),
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

  const id = generateId("ad");
  try {
    await db.insert(schema.ads).values({ id, ...parsed.data });
  } catch (err) {
    const conflict = mapSqliteUniqueError(err);
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to create ad" }, { status: 500 });
  }

  writeAudit({
    actorId: guard.user.id,
    action: "create",
    targetType: "ad",
    targetId: id,
    meta: parsed.data as unknown as Record<string, unknown>,
  });

  return NextResponse.json({ id, ...parsed.data }, { status: 201 });
}
