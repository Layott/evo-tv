import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { generateStreamKey, hashStreamKey } from "@/lib/video/stream-key";
import { getCurrentUser } from "@/lib/auth/guards";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const role = (user as { role?: string } | null)?.role;
  if (!user || role !== "admin") {
    return new NextResponse("Admin required", { status: 403 });
  }

  const { id } = await params;
  const row = db.select().from(schema.streams).where(eq(schema.streams.id, id)).get();
  if (!row) return new NextResponse("Stream not found", { status: 404 });

  const streamKey = generateStreamKey();
  db.update(schema.streams)
    .set({ streamKeyHash: hashStreamKey(streamKey) })
    .where(eq(schema.streams.id, id))
    .run();

  return NextResponse.json({
    id,
    streamKey,
    ingestUrl: process.env.RTMP_INGEST_URL ?? "rtmp://localhost:1935/live",
    warning: "Previous key is now invalid. This new key is shown once.",
  });
}
