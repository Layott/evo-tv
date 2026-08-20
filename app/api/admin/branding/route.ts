import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireMinRole } from "@/lib/auth/guards";
import { readBranding, writeBranding } from "@/lib/api/branding";
import { writeAudit } from "@/lib/api/audit";

/**
 * GET / PUT /api/admin/branding
 *
 * The name, tagline and mark the site presents itself with. Admin only: this is
 * what every visitor reads first.
 */

const bodySchema = z.object({
  siteName: z.string().trim().min(1).max(60),
  tagline: z.string().trim().max(160),
  logoUrl: z.string().trim().max(500),
});

export async function GET() {
  const guard = await requireMinRole("support_admin");
  if (!guard.ok) return guard.response;
  return NextResponse.json(await readBranding());
}

export async function PUT(req: NextRequest) {
  const guard = await requireMinRole("admin");
  if (!guard.ok) return guard.response;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const before = await readBranding();
  const saved = await writeBranding(parsed.data);

  void writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "roster",
    action: "branding.update",
    targetType: "site",
    targetId: "branding",
    before: before as unknown as Record<string, unknown>,
    after: saved as unknown as Record<string, unknown>,
  });

  return NextResponse.json(saved);
}
