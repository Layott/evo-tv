import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireAdminFromRequest } from "@/lib/api/admin";

function genId(): string {
  return (
    "ak_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Generate a fresh plaintext key. Format: `evo_<32 hex chars>`.
 * Prefix shown in UI = first 12 chars (`evo_a3b1c2d4`).
 */
function genPlainKey(): string {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `evo_${hex}`;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
});

/**
 * GET /api/account/api-keys: list caller's keys. Admin only.
 *
 * Never returns the plaintext value or the full hash. Only id, name,
 * prefix, lastUsedAt, createdAt, revokedAt.
 */
export async function GET() {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const rows = await db
    .select({
      id: schema.apiKeys.id,
      name: schema.apiKeys.name,
      prefix: schema.apiKeys.prefix,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      createdAt: schema.apiKeys.createdAt,
      revokedAt: schema.apiKeys.revokedAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.userId, user.id))
    .orderBy(desc(schema.apiKeys.createdAt));

  return NextResponse.json(rows);
}

/**
 * POST /api/account/api-keys: create + return plaintext ONCE. Admin only.
 *
 * Body: { name }. Plaintext key is returned in the `key` field; caller must
 * save it immediately, the server only stores sha256 hash + prefix.
 *
 * Limit: 10 active (non-revoked) keys per user.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const activeCount = await db
    .select({ id: schema.apiKeys.id })
    .from(schema.apiKeys)
    .where(
      and(
        eq(schema.apiKeys.userId, user.id),
        isNull(schema.apiKeys.revokedAt),
      ),
    );
  if (activeCount.length >= 10) {
    return NextResponse.json(
      { error: "API key limit reached (10 active). Revoke an old key first." },
      { status: 409 },
    );
  }

  const plain = genPlainKey();
  const id = genId();
  const prefix = plain.slice(0, 12);
  const keyHash = await sha256Hex(plain);

  await db.insert(schema.apiKeys).values({
    id,
    userId: user.id,
    name: parsed.data.name,
    keyHash,
    prefix,
  });

  return NextResponse.json({
    id,
    name: parsed.data.name,
    prefix,
    /** Returned ONCE — caller must save it now. */
    key: plain,
  });
}
