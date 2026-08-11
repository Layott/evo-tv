import "server-only";

import { db, schema } from "@/lib/db";
import { asc, eq } from "drizzle-orm";
import * as cloudflare from "./cloudflare";

/**
 * Provisioning the place a broadcast arrives from.
 *
 * There are two real ingests and one escape hatch:
 *
 *   cloudflare  Cloudflare Stream live input. Encoder pushes RTMPS to
 *               Cloudflare, Cloudflare does the transcoding ladder and the
 *               edge delivery. Nothing streams through our droplet.
 *   rtmp        Our own nginx-rtmp. The encoder pushes to us, nginx segments
 *               to HLS on disk, and the app serves it. Cheaper, no ABR, and
 *               it will not survive a real audience on a 2 vCPU box.
 *   manual      No provisioning. An operator pastes a manifest URL from
 *               wherever. Kept because it always works and needs no accounts.
 *
 * Both real paths end at the same place: a plain HLS URL on the stream row.
 * The players know nothing about any of this.
 */

export type IngestKind = "manual" | "cloudflare" | "rtmp";

export interface IngestDetails {
  kind: IngestKind;
  /** What goes in OBS: Settings, Stream, Custom, Server. */
  server: string | null;
  /** What goes in OBS: Stream Key. */
  streamKey: string | null;
  srtUrl?: string | null;
  /** Where viewers will watch. Empty until the ingest is provisioned. */
  hlsUrl: string;
  /**
   * True when the key can be fetched again later. Cloudflare stores it and
   * will hand it back; our own key is stored as a hash and genuinely cannot
   * be shown twice.
   */
  keyRetrievable: boolean;
}

/**
 * Which ingest to use when the caller does not say.
 *
 * Cloudflare when it is configured, because it is the only one that survives
 * an audience. Otherwise the self-hosted RTMP server if one is pointed at,
 * otherwise manual.
 */
export function defaultIngestKind(): IngestKind {
  if (cloudflare.isConfigured()) return "cloudflare";
  if (process.env.RTMP_INGEST_URL) return "rtmp";
  return "manual";
}

/**
 * Where nginx-rtmp's HLS output is reachable from a browser.
 *
 * nginx writes segments to disk and serves them on its own port; the app is on
 * another. `on-publish` used to store the bare path `/hls/<key>.m3u8`, which
 * resolves against the app origin, where nothing serves it. Every self-hosted
 * broadcast therefore produced a 404 manifest and a dead player.
 */
export function rtmpHlsBase(): string {
  return (
    process.env.RTMP_HLS_BASE_URL?.replace(/\/+$/, "") ??
    "http://localhost:8080/hls"
  );
}

export function rtmpHlsUrlFor(streamKey: string): string {
  return `${rtmpHlsBase()}/${streamKey}.m3u8`;
}

/**
 * The channel a new stream belongs to.
 *
 * Streams created through the admin API had `channelId` null, and the viewer
 * heartbeat endpoint drops any beat for a stream with no channel. So every
 * admin-created stream reported zero viewers no matter how many people were
 * watching. Falling back to the oldest channel keeps the count working on a
 * single-channel deployment, which is what this is.
 */
export async function defaultChannelId(): Promise<string | null> {
  const explicit = process.env.DEFAULT_CHANNEL_ID;
  if (explicit) return explicit;
  const row = (
    await db
      .select({ id: schema.channels.id })
      .from(schema.channels)
      .orderBy(asc(schema.channels.createdAt))
      .limit(1)
  )[0];
  return row?.id ?? null;
}

/**
 * Provision an ingest for a stream that has just been created.
 *
 * Never throws: a Cloudflare outage should leave the operator with a created
 * stream and a clear manual fallback, not a failed request and a half-made
 * row.
 */
export async function provisionIngest(
  kind: IngestKind,
  opts: { name: string; ownStreamKey: string },
): Promise<{ details: IngestDetails; cfLiveInputUid: string | null; error?: string }> {
  if (kind === "cloudflare") {
    try {
      const input = await cloudflare.createLiveInput(opts.name);
      return {
        cfLiveInputUid: input.uid,
        details: {
          kind: "cloudflare",
          server: input.rtmpsUrl,
          streamKey: input.rtmpsStreamKey,
          srtUrl: input.srtUrl,
          hlsUrl: input.hlsUrl,
          keyRetrievable: true,
        },
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Cloudflare Stream failed";
      // Degrade to manual rather than losing the stream the operator just made.
      return {
        cfLiveInputUid: null,
        error: message,
        details: {
          kind: "manual",
          server: null,
          streamKey: null,
          hlsUrl: "",
          keyRetrievable: false,
        },
      };
    }
  }

  if (kind === "rtmp") {
    return {
      cfLiveInputUid: null,
      details: {
        kind: "rtmp",
        server: process.env.RTMP_INGEST_URL ?? "rtmp://localhost:1935/live",
        streamKey: opts.ownStreamKey,
        hlsUrl: rtmpHlsUrlFor(opts.ownStreamKey),
        keyRetrievable: false,
      },
    };
  }

  return {
    cfLiveInputUid: null,
    details: {
      kind: "manual",
      server: null,
      streamKey: null,
      hlsUrl: "",
      keyRetrievable: false,
    },
  };
}

/**
 * Re-read ingest details for an existing stream.
 *
 * Cloudflare hands the key back, so an operator who closed the create dialog
 * can still set OBS up. For the self-hosted path only the server URL can be
 * shown: we store a hash of our own key and cannot recover it, which is the
 * correct trade and worth saying out loud in the UI.
 */
export async function ingestDetailsFor(streamId: string): Promise<IngestDetails | null> {
  const row = (
    await db
      .select({
        id: schema.streams.id,
        title: schema.streams.title,
        ingestKind: schema.streams.ingestKind,
        cfLiveInputUid: schema.streams.cfLiveInputUid,
        hlsPath: schema.streams.hlsPath,
      })
      .from(schema.streams)
      .where(eq(schema.streams.id, streamId))
      .limit(1)
  )[0];
  if (!row) return null;

  if (row.ingestKind === "cloudflare" && row.cfLiveInputUid) {
    const input = await cloudflare.getLiveInput(row.cfLiveInputUid);
    if (input) {
      return {
        kind: "cloudflare",
        server: input.rtmpsUrl,
        streamKey: input.rtmpsStreamKey,
        srtUrl: input.srtUrl,
        hlsUrl: input.hlsUrl || row.hlsPath,
        keyRetrievable: true,
      };
    }
  }

  if (row.ingestKind === "rtmp") {
    return {
      kind: "rtmp",
      server: process.env.RTMP_INGEST_URL ?? "rtmp://localhost:1935/live",
      streamKey: null,
      hlsUrl: row.hlsPath,
      keyRetrievable: false,
    };
  }

  return {
    kind: "manual",
    server: null,
    streamKey: null,
    hlsUrl: row.hlsPath,
    keyRetrievable: false,
  };
}
