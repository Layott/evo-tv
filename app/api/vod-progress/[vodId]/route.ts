import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getProgress, upsertProgress } from "@/lib/api/vod-progress";
import { getCurrentUser } from "@/lib/auth/guards";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ vodId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { vodId } = await params;
  return NextResponse.json(await getProgress(user.id, vodId));
}

const bodySchema = z.object({ positionSec: z.number().int().nonnegative() });

export async function POST(req: NextRequest, { params }: { params: Promise<{ vodId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { vodId } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  await upsertProgress(user.id, vodId, parsed.data.positionSec);
  return NextResponse.json({ ok: true });
}
