import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";

const bodySchema = z.object({
  adId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = db
    .update(schema.ads)
    .set({ impressions: sql`${schema.ads.impressions} + 1` })
    .where(eq(schema.ads.id, parsed.data.adId))
    .run();

  if (!result.changes) {
    return new NextResponse("Not found", { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
