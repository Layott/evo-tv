import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import { getStreamById } from "@/lib/api/streams";
import { listInitialMessages, postMessage } from "@/lib/api/chat";

// TODO(config): move banned words to a feature flag / admin-tunable list.
const BANNED_WORDS = ["spam", "slur1", "slur2"];
const SLOW_MODE_MS = 2000;

const postSchema = z.object({
  body: z.string().min(1).max(400),
});

// Per-user last-post timestamp for slow mode. In-memory is fine for a single
// Node process; replace with KV/Redis if we ever scale horizontally.
const lastPostAt = new Map<string, number>();

function containsBanned(body: string): boolean {
  const normalized = body.toLowerCase();
  return BANNED_WORDS.some((w) => normalized.includes(w));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stream = await getStreamById(id);
  if (!stream) return new NextResponse("Not found", { status: 404 });
  const messages = await listInitialMessages(id, 50);
  return NextResponse.json({ messages });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const { id } = await params;
  const stream = await getStreamById(id);
  if (!stream) return new NextResponse("Not found", { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const trimmed = parsed.data.body.trim();
  if (trimmed.length === 0) {
    return NextResponse.json({ error: "Empty message" }, { status: 422 });
  }
  if (containsBanned(trimmed)) {
    return NextResponse.json(
      { error: "Message blocked by moderation" },
      { status: 422 }
    );
  }

  const key = `${id}:${user.id}`;
  const now = Date.now();
  const prev = lastPostAt.get(key) ?? 0;
  if (now - prev < SLOW_MODE_MS) {
    const retryAfter = Math.ceil((SLOW_MODE_MS - (now - prev)) / 1000);
    return new NextResponse("Slow mode: please wait before sending again", {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfter)) },
    });
  }
  lastPostAt.set(key, now);

  const message = await postMessage({
    streamId: id,
    userId: user.id,
    body: trimmed,
  });
  return NextResponse.json({ message });
}
