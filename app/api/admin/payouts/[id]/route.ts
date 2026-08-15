import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { writeAudit } from "@/lib/api/audit";

/**
 * GET - view a payout.
 * POST - approve. Marks status=approved + kicks Paystack Transfer (stub
 *        in this phase; real transfer call lives behind a config flag
 *        until production-ready).
 */

const approveSchema = z.object({
  action: z.literal("approve"),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const { id } = await params;
  const row = (
    await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, id))
      .limit(1)
  )[0];
  if (!row) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(row);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const row = (
    await db
      .select()
      .from(schema.payouts)
      .where(eq(schema.payouts.id, id))
      .limit(1)
  )[0];
  if (!row) return new NextResponse("Not found", { status: 404 });
  if (row.status !== "pending") {
    return NextResponse.json(
      { error: `Payout already ${row.status}` },
      { status: 409 },
    );
  }

  // Phase 3.9 stub: mark approved + record audit. Real Paystack Transfer
  // wiring lives behind a feature flag - flip once payout volume justifies
  // the live integration.
  await db
    .update(schema.payouts)
    .set({ status: "approved" })
    .where(eq(schema.payouts.id, id));

  void writeAudit({
    actorId: guard.user.id,
    action: "update",
    targetType: "ad",
    targetId: id,
    meta: {
      event: "payout_approved",
      publisherId: row.publisherId,
      netNgn: row.netNgn,
    },
  });

  return NextResponse.json({ ok: true, status: "approved", id });
}
