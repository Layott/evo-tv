import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/guards";
import {
  registerExpoToken,
  unregisterExpoToken,
} from "@/lib/api/expo-push";

const registerSchema = z.object({
  token: z.string().min(10).max(256),
  platform: z.enum(["ios", "android", "web"]),
});

/**
 * POST /api/push/expo-token — auth required. Idempotent upsert; same token
 * may be re-registered on every app start. ON CONFLICT updates lastSeenAt.
 *
 * Returns `{ok: true}`. Tokens older than 6 months without a refresh are
 * pruned by the gdpr-purge cron.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  await registerExpoToken(user.id, parsed.data.token, parsed.data.platform);
  return NextResponse.json({ ok: true });
}

const unregisterSchema = z.object({
  token: z.string().min(10).max(256),
});

/**
 * DELETE /api/push/expo-token — auth required. Drops the device token from
 * the user's push list. Idempotent (no-op if the row isn't there).
 */
export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = unregisterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  await unregisterExpoToken(user.id, parsed.data.token);
  return NextResponse.json({ ok: true });
}
