import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getEntitlements } from "@/lib/api/entitlements";
import { getCurrentUser } from "@/lib/auth/guards";
import { getStreamById } from "@/lib/api/streams";
import { listInitialMessages, postMessage } from "@/lib/api/chat";
import { isChatBlocked } from "@/lib/sanctions";
import {
  banFromChatForMinutes,
  effectiveChatRules,
  recordStrike,
} from "@/lib/api/chat-rules";
import { refusalMessage, screenMessage } from "@/lib/chat/rules";

const SLOW_MODE_MS = 2000;

const postSchema = z.object({
  body: z.string().min(1).max(400),
  /** The message being answered, when this is a reply. */
  parentId: z.string().min(1).max(64).optional(),
});

// Per-user last-post timestamp for slow mode. In-memory is fine for a single
// Node process; replace with KV/Redis if we ever scale horizontally.
const lastPostAt = new Map<string, number>();

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

  if (await isChatBlocked(user.id)) {
    return NextResponse.json(
      { error: "You are banned from chat" },
      { status: 403 },
    );
  }

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
  /*
   * The rules an operator set, not three words in a comment.
   *
   * Links are the actual problem on a live channel: scam drops, fake giveaways,
   * somebody else's stream. A refusal counts as a strike, and enough strikes on
   * one broadcast writes the same timed ban the moderation queue writes, so
   * there is one list of who is banned and one thing that lifts it.
   */
  const rules = await effectiveChatRules(id);
  const verdict = screenMessage(trimmed, rules);
  if (!verdict.allowed) {
    const strikes = await recordStrike(user.id, id);
    if (rules.strikesBeforeBan > 0 && strikes >= rules.strikesBeforeBan) {
      const until = await banFromChatForMinutes(
        user.id,
        rules.banMinutes,
        verdict.reason === "link"
          ? `Posted links after ${strikes} warnings`
          : `Blocked words after ${strikes} warnings`,
      );
      return NextResponse.json(
        {
          error: `You are muted in chat until ${new Date(until).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.`,
          bannedUntil: until,
        },
        { status: 403 },
      );
    }
    return NextResponse.json(
      {
        error: refusalMessage(verdict),
        strikes,
        strikesBeforeBan: rules.strikesBeforeBan,
      },
      { status: 422 },
    );
  }

  // Slow mode is for the room, not for the people paying for it. This is the
  // second half of what the tiers page calls premium chat: the badge was
  // already rendered, the exemption was not.
  const entitlements = await getEntitlements(user.id, user.role);

  const key = `${id}:${user.id}`;
  const now = Date.now();
  const prev = lastPostAt.get(key) ?? 0;
  if (!entitlements.chatPerks && now - prev < SLOW_MODE_MS) {
    const retryAfter = Math.ceil((SLOW_MODE_MS - (now - prev)) / 1000);
    return new NextResponse("Slow mode: please wait before sending again", {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, retryAfter)) },
    });
  }
  lastPostAt.set(key, now);

  const message = await postMessage({
    target: { kind: "stream", id },
    userId: user.id,
    body: trimmed,
    parentId: parsed.data.parentId ?? null,
  });
  return NextResponse.json({ message });
}
