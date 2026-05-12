import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await params;
  const rows = await db
    .select({
      userId: schema.pickemEntries.userId,
      score: schema.pickemEntries.score,
      submittedAt: schema.pickemEntries.submittedAt,
      handle: schema.user.handle,
      name: schema.user.name,
      image: schema.user.image,
    })
    .from(schema.pickemEntries)
    .innerJoin(schema.user, eq(schema.user.id, schema.pickemEntries.userId))
    .where(eq(schema.pickemEntries.eventId, eventId))
    .orderBy(desc(schema.pickemEntries.score))
    .limit(100);

  return NextResponse.json(
    rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      handle: r.handle ?? r.name ?? "unknown",
      avatarUrl: r.image ?? "",
      score: r.score,
    })),
  );
}
