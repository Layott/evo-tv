import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db, schema } from "@/lib/db";
import { generateStreamKey, hashStreamKey } from "@/lib/video/stream-key";
import { getCurrentUser } from "@/lib/auth/guards";

const createSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).default(""),
  gameId: z.string().min(1),
  eventId: z.string().nullable().optional(),
  streamerName: z.string().min(1).max(100),
  streamerAvatarUrl: z.string().default(""),
  language: z.string().default("en"),
  tags: z.array(z.string()).default([]),
  isPremium: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  const role = (user as { role?: string } | null)?.role;
  if (!user || role !== "admin") {
    return new NextResponse("Admin required", { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const streamKey = generateStreamKey();
  const id =
    "stream_" + Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  const nowIso = new Date().toISOString();

  await db
    .insert(schema.streams)
    .values({
      id,
      title: parsed.data.title,
      description: parsed.data.description,
      eventId: parsed.data.eventId ?? null,
      gameId: parsed.data.gameId,
      streamerType: "official",
      streamerName: parsed.data.streamerName,
      streamerAvatarUrl: parsed.data.streamerAvatarUrl,
      streamKeyHash: hashStreamKey(streamKey),
      isLive: false,
      hlsPath: "",
      thumbnailUrl: "",
      viewerCount: 0,
      peakViewerCount: 0,
      language: parsed.data.language,
      tags: parsed.data.tags,
      isPremium: parsed.data.isPremium,
      createdAt: nowIso,
    });

  return NextResponse.json({
    id,
    streamKey,
    ingestUrl: process.env.RTMP_INGEST_URL ?? "rtmp://localhost:1935/live",
    warning: "This is the only time we show the full stream key. Store it securely.",
  });
}
