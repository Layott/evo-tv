import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireMinRole } from "@/lib/auth/guards";
import { writeAudit } from "@/lib/api/audit";
import {
  CreatorAppError,
  reviewApplication,
} from "@/lib/api/creator-program";

const schema = z.object({
  status: z.enum(["in_review", "approved", "rejected"]),
  note: z.string().max(2000).optional(),
});

/**
 * PATCH /api/admin/creator-program/[id]
 * Body: { status, note? }
 * Sets the application status + writes an audit row. moderator+.
 *
 * NOTE: approving an application doesn't promote the user's role here -
 * that's a separate admin action so the partner-creator promotion + Stripe
 * onboarding + Paystack subaccount creation can be batched together.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const app = await reviewApplication(id, parsed.data.status, parsed.data.note);
    await writeAudit({
      actorId: guard.user.id,
      action: `creator_program.${parsed.data.status}`,
      targetType: "creator_application",
      targetId: id,
      meta: {
        role: guard.role,
        applicantUserId: app.userId,
        note: parsed.data.note ?? null,
      },
    });
    return NextResponse.json(app);
  } catch (err) {
    if (err instanceof CreatorAppError) {
      const status = err.code === "not_found" ? 404 : 422;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    throw err;
  }
}
