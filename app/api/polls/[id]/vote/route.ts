import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { vote } from "@/lib/api/polls";

const schema = z.object({
  optionId: z.string().min(1).max(64),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const poll = await vote({
    userId: user.id,
    pollId: id,
    optionId: parsed.data.optionId,
  });
  if (!poll) return new NextResponse("Not found", { status: 404 });
  if (poll.isClosed) {
    return NextResponse.json({ error: "Poll is closed", poll }, { status: 409 });
  }
  return NextResponse.json({ poll });
}
