import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, count, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { generateStreamKey, hashStreamKey } from "@/lib/video/stream-key";
import { getCurrentUser } from "@/lib/auth/guards";
import { requireAdminFromRequest } from "@/lib/api/admin";
import {
  defaultChannelId,
  defaultIngestKind,
  provisionIngest,
} from "@/lib/video/ingest";

const listQuerySchema = z.object({
  gameId: z.string().optional(),
  isLive: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  /** Filter by deleted state: 'only' = deleted only, 'include' = both, undefined = active only (default). */
  deleted: z.enum(["only", "include"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/admin/streams - admin list of ALL streams (live + offline).
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
  const { gameId, isLive, deleted, limit, offset } = parsed.data;

  const filters = [
    gameId ? eq(schema.streams.gameId, gameId) : undefined,
    typeof isLive === "boolean" ? eq(schema.streams.isLive, isLive) : undefined,
    deleted === "only"
      ? isNotNull(schema.streams.deletedAt)
      : deleted === "include"
        ? undefined
        : isNull(schema.streams.deletedAt),
  ].filter(Boolean) as Parameters<typeof and>;

  const whereClause = filters.length ? and(...filters) : undefined;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: schema.streams.id,
        title: schema.streams.title,
        description: schema.streams.description,
        eventId: schema.streams.eventId,
        gameId: schema.streams.gameId,
        channelId: schema.streams.channelId,
        streamerType: schema.streams.streamerType,
        streamerName: schema.streams.streamerName,
        streamerAvatarUrl: schema.streams.streamerAvatarUrl,
        isLive: schema.streams.isLive,
        hlsPath: schema.streams.hlsPath,
        playoutFilePath: schema.streams.playoutFilePath,
        thumbnailUrl: schema.streams.thumbnailUrl,
        viewerCount: schema.streams.viewerCount,
        peakViewerCount: schema.streams.peakViewerCount,
        language: schema.streams.language,
        tags: schema.streams.tags,
        isPremium: schema.streams.isPremium,
        scheduledStartAt: schema.streams.scheduledStartAt,
        scheduledDurationMin: schema.streams.scheduledDurationMin,
        createdAt: schema.streams.createdAt,
        startedAt: schema.streams.startedAt,
        endedAt: schema.streams.endedAt,
        deletedAt: schema.streams.deletedAt,
      })
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

  // Rename hlsPath → hlsUrl to match RN's Stream type contract.
  const streams = rows.map(({ hlsPath, ...rest }) => ({
    ...rest,
    hlsUrl: hlsPath,
  }));

  return NextResponse.json({
    streams,
    total: totalRow[0]?.value ?? 0,
    limit,
    offset,
  });
}

const createSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(2000).default(""),
  // Optional: two of the three pillars have no game. Requiring it forced an
  // operator to tag an anime episode or a podcast as Free Fire, and viewers
  // then saw that badge on it.
  gameId: z.string().min(1).nullish(),
  // What the programme is. The create route accepted no pillar at all, so
  // every stream an admin made landed as `esports` whatever they meant, and
  // the pillar filters on /schedule and the landing week grid could never see
  // an anime or lifestyle programme. This is the field that classifies a
  // programme now that a game is optional.
  pillar: z.enum(["esports", "anime", "lifestyle"]).default("esports"),
  eventId: z.string().nullable().optional(),
  streamerName: z.string().min(1).max(100),
  streamerAvatarUrl: z.string().default(""),
  language: z.string().default("en"),
  tags: z.array(z.string()).default([]),
  isPremium: z.boolean().default(false),
  maturityRating: z.enum(["kids", "pg", "teen", "mature"]).default("teen"),
  contentTags: z.array(z.string()).default([]),
  /**
   * Where the broadcast will arrive from. Omitted means "whatever this
   * deployment is set up for": Cloudflare when it is configured, otherwise the
   * self-hosted RTMP server, otherwise a manual paste.
   */
  ingestKind: z.enum(["manual", "cloudflare", "rtmp"]).optional(),
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

  // Provisioning happens before the insert so the row carries its playback URL
  // from the moment it exists. It never throws: a Cloudflare outage degrades to
  // a manual paste rather than losing the stream the operator just created.
  const kind = parsed.data.ingestKind ?? defaultIngestKind();
  const { details, cfLiveInputUid, error: ingestError } = await provisionIngest(
    kind,
    { name: parsed.data.title, ownStreamKey: streamKey, streamId: id },
  );

  // Without a channel the viewer heartbeat endpoint drops every beat, so an
  // admin-created stream reported zero viewers however many were watching.
  const channelId = await defaultChannelId();

  await db
    .insert(schema.streams)
    .values({
      id,
      channelId,
      ingestKind: details.kind,
      cfLiveInputUid,
      title: parsed.data.title,
      description: parsed.data.description,
      eventId: parsed.data.eventId ?? null,
      gameId: parsed.data.gameId ?? null,
      pillar: parsed.data.pillar,
      streamerType: "official",
      streamerName: parsed.data.streamerName,
      streamerAvatarUrl: parsed.data.streamerAvatarUrl,
      streamKeyHash: hashStreamKey(streamKey),
      isLive: false,
      hlsPath: details.hlsUrl,
      thumbnailUrl: "",
      viewerCount: 0,
      peakViewerCount: 0,
      language: parsed.data.language,
      tags: parsed.data.tags,
      isPremium: parsed.data.isPremium,
      maturityRating: parsed.data.maturityRating,
      contentTags: parsed.data.contentTags,
      createdAt: nowIso,
    });

  return NextResponse.json({
    id,
    ingest: details,
    /**
     * Our own key. Only meaningful for the self-hosted RTMP path; Cloudflare
     * issues its own, which is in `ingest.streamKey`. It was previously
     * returned as the headline value for every stream, which meant an operator
     * pasted a key into OBS that nothing on the internet would ever check.
     */
    streamKey,
    ingestError: ingestError ?? null,
    warning: details.keyRetrievable
      ? null
      : "This is the only time we show the full stream key. Store it securely.",
  });
}
