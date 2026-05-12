import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

/**
 * Idempotency-Key middleware for money-touching routes.
 *
 * Usage in a route handler:
 *
 *   const replay = await checkIdempotency(req, user.id);
 *   if (replay) return replay;
 *   // … perform mutation …
 *   const res = NextResponse.json({ … });
 *   await recordIdempotency(req, user.id, res.status, { … });
 *   return res;
 *
 * - Header is required: 422 if missing.
 * - Replay window: 24h. After that the key can be re-used.
 * - Key + user_id uniqueness — different users can use the same key string.
 */

const REPLAY_WINDOW_HOURS = 24;

function genId(): string {
  return (
    "idem_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export class IdempotencyRequiredError extends Error {
  status = 422 as const;
  constructor() {
    super("Idempotency-Key header required");
  }
}

interface CachedResponse {
  status: number;
  body: unknown;
}

export async function checkIdempotency(
  req: NextRequest,
  userId: string,
): Promise<NextResponse | null> {
  const key = req.headers.get("idempotency-key");
  if (!key) {
    return NextResponse.json(
      { error: "Idempotency-Key header required" },
      { status: 422 },
    );
  }
  if (key.length < 8 || key.length > 128) {
    return NextResponse.json(
      { error: "Idempotency-Key must be 8-128 chars" },
      { status: 422 },
    );
  }

  const existing = (
    await db
      .select()
      .from(schema.idempotencyKeys)
      .where(
        and(
          eq(schema.idempotencyKeys.userId, userId),
          eq(schema.idempotencyKeys.key, key),
        ),
      )
      .limit(1)
  )[0];

  if (!existing) return null;

  const ageMs = Date.now() - new Date(existing.createdAt).getTime();
  if (ageMs > REPLAY_WINDOW_HOURS * 3600_000) return null;

  const cached: CachedResponse = {
    status: existing.responseStatus,
    body: existing.responseBody,
  };
  return NextResponse.json(cached.body ?? {}, { status: cached.status });
}

export async function recordIdempotency(
  req: NextRequest,
  userId: string,
  responseStatus: number,
  responseBody: unknown,
): Promise<void> {
  const key = req.headers.get("idempotency-key");
  if (!key) return;
  await db
    .insert(schema.idempotencyKeys)
    .values({
      id: genId(),
      userId,
      key,
      method: req.method,
      path: new URL(req.url).pathname,
      responseStatus,
      responseBody,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoNothing();
}
