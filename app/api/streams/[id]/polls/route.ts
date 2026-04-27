import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { getStreamById } from "@/lib/api/streams";
import { createPoll, listActivePolls } from "@/lib/api/polls";

const optionSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(200),
});

const createSchema = z.object({
  question: z.string().min(3).max(300),
  options: z.array(optionSchema).min(2).max(10),
  closesAt: z.string().min(1),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stream = await getStreamById(id);
  if (!stream) return new NextResponse("Not found", { status: 404 });
  const polls = await listActivePolls(id);
  return NextResponse.json({ polls });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const role = (user as { role?: string }).role ?? "user";
  if (role !== "admin") return new NextResponse("Admin required", { status: 403 });

  const { id } = await params;
  const stream = await getStreamById(id);
  if (!stream) return new NextResponse("Not found", { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Dedup option ids to avoid collisions.
  const ids = new Set(parsed.data.options.map((o) => o.id));
  if (ids.size !== parsed.data.options.length) {
    return NextResponse.json({ error: "Duplicate option ids" }, { status: 422 });
  }

  const poll = await createPoll({
    streamId: id,
    question: parsed.data.question,
    options: parsed.data.options,
    closesAt: parsed.data.closesAt,
  });
  return NextResponse.json({ poll });
}
