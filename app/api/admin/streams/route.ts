import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { generateStreamKey, hashStreamKey } from "@/lib/video/stream-key";
import { getCurrentUser } from "@/lib/auth/guards";
import { requireAdminFromRequest } from "@/lib/api/admin";

const listQuerySchema = z.object({
  gameId: z.string().optional(),
  isLive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/streams — admin list of ALL streams (live + offline).
 * Optional filters: ?gameId=&isLive=true|false&limit=&offset=
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const { gameId, isLive, limit, offset } = parsed.data;

  const filters = [
    gameId ? eq(schema.streams.gameId, gameId) : undefined,
    typeof isLive === "boolean" ? eq(schema.streams.isLive, isLive) : undefined,
  ].filter(Boolean) as Parameters<typeof and>;

  const whereClause = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select()
      .from(schema.streams)
      .where(whereClause as ReturnType<typeof and>)
      .orderBy(desc(schema.streams.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(schema.streams)
      .where(whereClause as ReturnType<typeof and>),
  ]);

  return NextResponse.json({
    streams: rows,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  });
}

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
