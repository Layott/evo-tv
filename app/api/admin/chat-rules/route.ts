import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireMinRole } from "@/lib/auth/guards";
import { readChatRules, writeChatRules } from "@/lib/api/chat-rules";
import { writeAudit } from "@/lib/api/audit";

/**
 * GET  /api/admin/chat-rules            the house rules
 * GET  /api/admin/chat-rules?streamId=  one broadcast's own
 * PUT  either of the above
 *
 * A stream's rules replace the house rules rather than adding to them, so an
 * operator relaxing links for one match cannot silently inherit a word list
 * from six months ago.
 */

const bodySchema = z.object({
  blockLinks: z.boolean(),
  allowedDomains: z.array(z.string().trim().min(1).max(120)).max(50),
  bannedWords: z.array(z.string().trim().min(1).max(60)).max(200),
  /** 0 turns automatic bans off and leaves the message blocking in place. */
  strikesBeforeBan: z.number().int().min(0).max(20),
  banMinutes: z.number().int().min(1).max(60 * 24 * 30),
});

export async function GET(req: NextRequest) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const streamId = new URL(req.url).searchParams.get("streamId");
  return NextResponse.json(await readChatRules(streamId || null));
}

export async function PUT(req: NextRequest) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const streamId = new URL(req.url).searchParams.get("streamId") || null;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const before = await readChatRules(streamId);
  const saved = await writeChatRules(streamId, parsed.data);

  void writeAudit({
    actorId: guard.user.id,
    actorRole: guard.role,
    capability: "community",
    action: "chat_rules.update",
    targetType: streamId ? "stream" : "channel",
    targetId: streamId ?? "house",
    before: before as unknown as Record<string, unknown>,
    after: saved as unknown as Record<string, unknown>,
  });

  return NextResponse.json(saved);
}
