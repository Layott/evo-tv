import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { desc, eq, type SQL } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireMinRole } from "@/lib/auth/guards";

const querySchema = z.object({
  ipHash: z.string().optional(),
  deviceFp: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/login-events
 *
 * Recent sign-in events platform-wide. JOINs user for handle/email.
 * Optional filters:
 *   ?ipHash=<hash>      - find every account that signed in from this IP
 *   ?deviceFp=<id>      - find every account on this device
 *
 * Used by the forensic admin screen to detect ban-evasion.
 * Moderator+.
 */
export async function GET(req: NextRequest) {
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { ipHash, deviceFp, limit, offset } = parsed.data;

  const filters: SQL[] = [];
  if (ipHash) filters.push(eq(schema.loginEvents.ipHash, ipHash));
  if (deviceFp) filters.push(eq(schema.loginEvents.deviceFp, deviceFp));

  const baseQuery = db
    .select({
      id: schema.loginEvents.id,
      userId: schema.loginEvents.userId,
      ipHash: schema.loginEvents.ipHash,
      region: schema.loginEvents.region,
      userAgent: schema.loginEvents.userAgent,
      deviceFp: schema.loginEvents.deviceFp,
      method: schema.loginEvents.method,
      createdAt: schema.loginEvents.createdAt,
      userHandle: schema.user.handle,
      userEmail: schema.user.email,
      userName: schema.user.name,
    })
    .from(schema.loginEvents)
    .innerJoin(schema.user, eq(schema.loginEvents.userId, schema.user.id));

  const rows = filters.length
    ? await baseQuery
        .where(filters.length === 1 ? filters[0] : (filters[0] as SQL))
        .orderBy(desc(schema.loginEvents.createdAt))
        .limit(limit)
        .offset(offset)
    : await baseQuery
        .orderBy(desc(schema.loginEvents.createdAt))
        .limit(limit)
        .offset(offset);

  return NextResponse.json({ events: rows });
}
