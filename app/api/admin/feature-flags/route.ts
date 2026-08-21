import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";
import { listFlags, setFlag } from "@/lib/api/flags";

const upsertSchema = z.object({
  key: z.string().min(1).max(200),
  enabled: z.boolean(),
  description: z.string().max(1000).optional(),
  payload: z.record(z.unknown()).nullable().optional(),
});

export async function GET() {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const flags = await listFlags();
  return NextResponse.json(flags);
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
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const row = await setFlag(
      parsed.data.key,
      parsed.data.enabled,
      parsed.data.description,
      parsed.data.payload ?? undefined
    );
    try {
      await writeAudit({
    before: null,
    after: row as unknown as Record<string, unknown>,
        actorId: guard.user.id,
        action: "upsert",
        targetType: "feature_flag",
        targetId: parsed.data.key,
        meta: parsed.data as unknown as Record<string, unknown>,
      });
    } catch {
      /* audit failure must not block primary mutation */
    }
    return NextResponse.json(row, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Failed to upsert flag" }, { status: 500 });
  }
}
