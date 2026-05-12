import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { emit } from "@/lib/sse/bus";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { id } = await params;

  await db
    .update(schema.partyMembers)
    .set({ leftAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.partyMembers.partyId, id),
        eq(schema.partyMembers.userId, user.id),
      ),
    );

  emit(`party:${id}:presence`, {
    type: "left",
    userId: user.id,
    at: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}
