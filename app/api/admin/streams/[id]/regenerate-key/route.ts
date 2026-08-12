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
  const row = (await db.select().from(schema.streams).where(eq(schema.streams.id, id)).limit(1))[0];
  if (!row) return new NextResponse("Stream not found", { status: 404 });

  const streamKey = generateStreamKey();
  await db
    .update(schema.streams)
    .set({ streamKeyHash: hashStreamKey(streamKey) })
    .where(eq(schema.streams.id, id));

  /*
   * Hand back what OBS should actually be given, not the bare secret.
   *
   * nginx-rtmp names its HLS output after the publish name, so a broadcaster
   * who pastes the bare key publishes as `/hls/<KEY>.m3u8` and the credential
   * appears in every viewer's network tab. `provisionIngest` has composed
   * `<streamId>?key=<secret>` since the fix, but this route was still
   * returning the raw key, so the one path an operator uses to rotate handed
   * back the leaky form and quietly undid the fix.
   *
   * A Cloudflare-ingest stream does not publish to us at all, so composing an
   * RTMP key for it would be a lie; return the secret with a note instead.
   */
  const isRtmp = row.ingestKind === "rtmp";

  return NextResponse.json({
    id,
    streamKey: isRtmp ? `${id}?key=${streamKey}` : streamKey,
    secret: streamKey,
    ingestUrl: process.env.RTMP_INGEST_URL ?? "rtmp://localhost:1935/live",
    warning: isRtmp
      ? "Previous key is now invalid. Paste this whole string, query argument included, into the OBS Stream Key field. It is shown once."
      : "Previous key is now invalid. This new key is shown once. This stream ingests through Cloudflare, so OBS should use the Cloudflare server and key from Broadcast settings.",
  });
}
