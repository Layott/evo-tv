import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/guards";
import {
  getEpisodeById,
  getEpisodeProgress,
  upsertEpisodeProgress,
} from "@/lib/api/shows";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  positionSec: z.number().min(0).max(86_400),
  completed: z.boolean().optional(),
});

/** GET /api/episodes/[id]/progress - current user's saved position on this
 *  episode, or `null` if they've never watched it. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { id } = await params;
  return NextResponse.json(await getEpisodeProgress(user.id, id));
}

/** POST /api/episodes/[id]/progress - upsert watch progress. Auth required. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "invalid_id" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const ep = await getEpisodeById(id);
  if (!ep) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await upsertEpisodeProgress(
    user.id,
    id,
    parsed.data.positionSec,
    parsed.data.completed ?? false,
  );
  return NextResponse.json({ ok: true });
}
