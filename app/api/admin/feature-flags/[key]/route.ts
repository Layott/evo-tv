import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import { deleteFlag, getFlag, setFlag } from "@/lib/api/flags";

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    description: z.string().max(1000).optional(),
    payload: z.record(z.unknown()).nullable().optional(),
  })
  .refine(
    (v) =>
      v.enabled !== undefined ||
      v.description !== undefined ||
      v.payload !== undefined,
    { message: "At least one field required" }
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const { key } = await params;
  const existing = await getFlag(key);
  if (!existing) return new NextResponse("Flag not found", { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const nextEnabled =
    parsed.data.enabled !== undefined ? parsed.data.enabled : existing.enabled;

  try {
    const row = await setFlag(
      key,
      nextEnabled,
      parsed.data.description,
      parsed.data.payload ?? undefined
    );
    try {
      await writeAudit({
    before: existing as unknown as Record<string, unknown>,
    after: row as unknown as Record<string, unknown>,
        actorId: guard.user.id,
        action: "update",
        targetType: "feature_flag",
        targetId: key,
        meta: parsed.data as unknown as Record<string, unknown>,
      });
    } catch {
      /* best-effort */
    }
    return NextResponse.json(row);
  } catch {
    return NextResponse.json({ error: "Failed to update flag" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const { key } = await params;
  const existing = await getFlag(key);
  if (!existing) return new NextResponse("Flag not found", { status: 404 });

  const url = new URL(req.url);
  const hard = url.searchParams.get("hard") === "1";

  try {
    const result = await deleteFlag(key, { hard });
    try {
      await writeAudit({
        actorId: guard.user.id,
        action: hard ? "delete" : "disable",
        before: existing as unknown as Record<string, unknown>,
        after: hard ? null : { ...existing, enabled: false },
        targetType: "feature_flag",
        targetId: key,
        meta: existing as unknown as Record<string, unknown>,
      });
    } catch {
      /* best-effort */
    }
    if (hard) return new NextResponse(null, { status: 204 });
    return NextResponse.json({ key, ...result, enabled: false });
  } catch {
    return NextResponse.json({ error: "Failed to delete flag" }, { status: 500 });
  }
}
