import { NextResponse, type NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

/**
 * Which URLs oEmbed will answer for, and where the iframe points.
 *
 * Every host here used to be somewhere the site no longer lives: two Vercel
 * deployments that 404, and `evotv.app`, a domain we do not own. `evotv.co`,
 * the domain it actually runs on, was not in the list, so oEmbed rejected every
 * real URL and the embed it handed back pointed at a dead host.
 *
 * Driven off `SITE_URL` now, so a domain change moves this with it.
 */
const SITE_HOST = new URL(SITE_URL).hostname;

const ALLOWED_HOSTS = new Set([SITE_HOST, `www.${SITE_HOST}`]);

const EMBED_BASE = SITE_URL;
const PROVIDER_NAME = "EVO TV";
const PROVIDER_URL = SITE_URL;

interface OEmbedVideo {
  type: "video";
  version: "1.0";
  provider_name: string;
  provider_url: string;
  title: string;
  author_name?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  html: string;
  width: number;
  height: number;
}

function parseTarget(rawUrl: string):
  | { kind: "stream" | "vod" | "clip"; id: string }
  | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return null;

  // Recognized URL shapes (both `/stream/<id>` and `/(public)/stream/<id>`):
  //   /stream/<id>
  //   /vod/<id>
  //   /clip/<id>
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) return null;
  const [kindRaw, id] = segments;
  if (kindRaw === "stream") return { kind: "stream", id };
  if (kindRaw === "vod") return { kind: "vod", id };
  if (kindRaw === "clip") return { kind: "clip", id };
  return null;
}

function clampDims(maxWidth?: number, maxHeight?: number): { width: number; height: number } {
  const width = Math.max(160, Math.min(maxWidth ?? 560, 1920));
  // 16:9, capped by maxHeight if supplied.
  const aspectHeight = Math.round((width * 9) / 16);
  const height = Math.max(90, Math.min(maxHeight ?? aspectHeight, 1080));
  return { width, height: Math.min(height, aspectHeight) };
}

/**
 * GET /api/oembed?url=<evotv-url>&maxwidth=&maxheight=&format=json
 *
 * Implements the oEmbed spec (1.0) for EVO TV streams/VODs/clips so third
 * parties (Twitter cards, Reddit, blog embeds via WordPress, Discord
 * previews, …) can render a video card. Only `format=json` is supported.
 *
 * For the discovery side, public pages (`/stream/<id>` etc.) should include:
 *   <link rel="alternate" type="application/json+oembed"
 *         href="https://evo-tv.vercel.app/api/oembed?url=...">
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rawUrl = url.searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  const format = url.searchParams.get("format") ?? "json";
  if (format !== "json") {
    return new NextResponse("Unsupported format (json only)", { status: 501 });
  }
  const target = parseTarget(rawUrl);
  if (!target) {
    return NextResponse.json(
      { error: "URL not recognized as an EVO TV resource" },
      { status: 404 },
    );
  }

  const maxWidth = Number(url.searchParams.get("maxwidth")) || undefined;
  const maxHeight = Number(url.searchParams.get("maxheight")) || undefined;
  const { width, height } = clampDims(maxWidth, maxHeight);

  let payload: OEmbedVideo | null = null;

  if (target.kind === "stream") {
    const row = (
      await db
        .select()
        .from(schema.streams)
        .where(
          and(
            eq(schema.streams.id, target.id),
            isNull(schema.streams.deletedAt),
          ),
        )
        .limit(1)
    )[0];
    if (row) {
      payload = {
        type: "video",
        version: "1.0",
        provider_name: PROVIDER_NAME,
        provider_url: PROVIDER_URL,
        title: row.title,
        author_name: row.streamerName,
        thumbnail_url: row.thumbnailUrl || undefined,
        thumbnail_width: row.thumbnailUrl ? 1280 : undefined,
        thumbnail_height: row.thumbnailUrl ? 720 : undefined,
        html: `<iframe src="${EMBED_BASE}/embed/player/${row.id}" width="${width}" height="${height}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`,
        width,
        height,
      };
    }
  } else if (target.kind === "vod") {
    const row = (
      await db
        .select()
        .from(schema.vods)
        .where(
          and(eq(schema.vods.id, target.id), isNull(schema.vods.deletedAt)),
        )
        .limit(1)
    )[0];
    if (row) {
      payload = {
        type: "video",
        version: "1.0",
        provider_name: PROVIDER_NAME,
        provider_url: PROVIDER_URL,
        title: row.title,
        thumbnail_url: row.thumbnailUrl || undefined,
        thumbnail_width: row.thumbnailUrl ? 1280 : undefined,
        thumbnail_height: row.thumbnailUrl ? 720 : undefined,
        html: `<iframe src="${EMBED_BASE}/embed/vod/${row.id}" width="${width}" height="${height}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`,
        width,
        height,
      };
    }
  } else {
    const row = (
      await db
        .select()
        .from(schema.clips)
        .where(
          and(eq(schema.clips.id, target.id), isNull(schema.clips.deletedAt)),
        )
        .limit(1)
    )[0];
    if (row) {
      payload = {
        type: "video",
        version: "1.0",
        provider_name: PROVIDER_NAME,
        provider_url: PROVIDER_URL,
        title: row.title,
        author_name: row.creatorHandle,
        thumbnail_url: row.thumbnailUrl || undefined,
        thumbnail_width: row.thumbnailUrl ? 1280 : undefined,
        thumbnail_height: row.thumbnailUrl ? 720 : undefined,
        html: `<iframe src="${EMBED_BASE}/embed/clip/${row.id}" width="${width}" height="${height}" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`,
        width,
        height,
      };
    }
  }

  if (!payload) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
