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
    placement: z.enum(["home_banner", "stream_preroll", "sidebar", "between_content"]),
    mediaUrl: z.string(),
    clickUrl: z.string(),
    advertiser: z.string().min(1).max(200),
    active: z.boolean(),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    weight: z.number().int().nonnegative(),
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
      .from(schema.ads)
      .where(eq(schema.ads.id, id))
      .limit(1)
  )[0];
  if (!existing) return new NextResponse("Ad not found", { status: 404 });

  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json(existing);
  }

  try {
    await db.update(schema.ads).set(parsed.data).where(eq(schema.ads.id, id));
  } catch (err) {
    const conflict = mapSqliteUniqueError(err);
    if (conflict) return conflict;
    return NextResponse.json({ error: "Failed to update ad" }, { status: 500 });
  }

  const updated = (
    await db
      .select()
      .from(schema.ads)
      .where(eq(schema.ads.id, id))
      .limit(1)
  )[0];

  writeAudit({
    actorId: guard.user.id,
    action: "update",
    targetType: "ad",
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
      .from(schema.ads)
      .where(eq(schema.ads.id, id))
      .limit(1)
  )[0];
  if (!existing) return new NextResponse("Ad not found", { status: 404 });

  try {
    await db.delete(schema.ads).where(eq(schema.ads.id, id));
  } catch {
    return NextResponse.json({ error: "Failed to delete ad" }, { status: 500 });
  }

  writeAudit({
    actorId: guard.user.id,
    action: "delete",
    targetType: "ad",
    targetId: id,
    meta: existing as unknown as Record<string, unknown>,
  });

  return new NextResponse(null, { status: 204 });
}
