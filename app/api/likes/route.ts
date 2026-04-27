import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { toggleLike } from "@/lib/api/likes";

const schema = z.object({
  targetType: z.enum(["vod", "clip"]),
  targetId: z.string().min(1).max(128),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await toggleLike(
    user.id,
    parsed.data.targetType,
    parsed.data.targetId
  );
  return NextResponse.json(result);
}
