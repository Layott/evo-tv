import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { listInitialMessages, postMessage } from "@/lib/api/chat";
import { isChatBlocked } from "@/lib/sanctions";
import { effectiveChatRules } from "@/lib/api/chat-rules";
import { refusalMessage, screenMessage } from "@/lib/chat/rules";
import { DEFAULT_CHAT_RULES } from "@/lib/chat/rules";

/**
 * Chat under a recording.
 *
 * The same table, the same bans and the same rules as a live chat, because a
 * second implementation would need all three again and would drift from the
 * first the week after it shipped. What differs is the pace: nobody is talking
 * over a broadcast here, so there is no slow mode.
 *
 * The house rules apply. A recording has no stream of its own to carry a
 * per-broadcast rule, and inheriting the rule from the stream it came from
 * would mean a rule set for one night silently governing a page for years.
 */

const postSchema = z.object({
  body: z.string().min(1).max(1000),
  parentId: z.string().min(1).max(64).optional(),
});

async function vodExists(id: string): Promise<boolean> {
  const row = (
    await db.select({ id: schema.vods.id }).from(schema.vods).where(eq(schema.vods.id, id)).limit(1)
  )[0];
  return Boolean(row);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!(await vodExists(id))) return new NextResponse("Not found", { status: 404 });
  const messages = await listInitialMessages({ kind: "vod", id }, 100);
  return NextResponse.json({ messages });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  if (await isChatBlocked(user.id)) {
    return NextResponse.json({ error: "You are banned from chat" }, { status: 403 });
  }

  const { id } = await params;
  if (!(await vodExists(id))) return new NextResponse("Not found", { status: 404 });

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const trimmed = parsed.data.body.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Empty message" }, { status: 422 });
  }

  // House rules. `effectiveChatRules` wants a stream, and a recording has none,
  // so the empty id falls through to the house row by design.
  const rules = await effectiveChatRules("").catch(() => DEFAULT_CHAT_RULES);
  const verdict = screenMessage(trimmed, rules);
  if (!verdict.allowed) {
    return NextResponse.json({ error: refusalMessage(verdict) }, { status: 422 });
  }

  const message = await postMessage({
    target: { kind: "vod", id },
    userId: user.id,
    body: trimmed,
    parentId: parsed.data.parentId ?? null,
  });

  return NextResponse.json({ message });
}
