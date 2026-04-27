import "server-only";
import PQueue from "p-queue";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { subscribe } from "@/lib/sse/bus";

const UPLOADS = path.resolve(process.env.UPLOADS_DIR ?? "./uploads");
const HLS_SRC = path.resolve(process.env.HLS_OUTPUT_DIR ?? "./uploads/hls");

const queue = new PQueue({ concurrency: 1 });

let registered = false;

async function hasFfmpeg(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("ffmpeg", ["-version"], { stdio: "ignore" });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => {
      err += d.toString();
    });
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exit ${code}: ${err.slice(-500)}`));
    });
  });
}

async function transcodeStreamToVod(streamId: string): Promise<string | null> {
  const stream = db
    .select()
    .from(schema.streams)
    .where(eq(schema.streams.id, streamId))
    .get();
  if (!stream) {
    console.log(`[transcode] stream ${streamId} not found — skip`);
    return null;
  }

  const vodId =
    "vod_" +
    Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  const vodDir = path.join(UPLOADS, "vods", vodId);
  fs.mkdirSync(vodDir, { recursive: true });

  const ffmpegOk = await hasFfmpeg();
  let hlsPath = "";
  let mp4Path = "";
  let durationSec = 0;

  if (ffmpegOk) {
    const sourceSegmentsDir = HLS_SRC;
    const sourcePlaylistCandidate = path.join(sourceSegmentsDir, "index.m3u8");
    const hasSource = fs.existsSync(sourcePlaylistCandidate);

    if (hasSource) {
      const ladder = [
        { name: "1080p", height: 1080, bitrate: "5000k" },
        { name: "720p", height: 720, bitrate: "2800k" },
        { name: "360p", height: 360, bitrate: "800k" },
      ];
      try {
        for (const rung of ladder) {
          await runFfmpeg([
            "-y",
            "-i", sourcePlaylistCandidate,
            "-vf", `scale=-2:${rung.height}`,
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-b:v", rung.bitrate,
            "-c:a", "aac",
            "-b:a", "128k",
            "-hls_time", "4",
            "-hls_playlist_type", "vod",
            "-hls_segment_filename", path.join(vodDir, `${rung.name}_%03d.ts`),
            path.join(vodDir, `${rung.name}.m3u8`),
          ]);
        }
        const master = [
          "#EXTM3U",
          "#EXT-X-VERSION:3",
          ...ladder.flatMap((r) => [
            `#EXT-X-STREAM-INF:BANDWIDTH=${parseInt(r.bitrate) * 1000},RESOLUTION=x${r.height}`,
            `${r.name}.m3u8`,
          ]),
          "",
        ].join("\n");
        fs.writeFileSync(path.join(vodDir, "master.m3u8"), master);
        hlsPath = `vods/${vodId}/master.m3u8`;
        mp4Path = "";
        console.log(`[transcode] ${streamId} → ${vodId} (3-rung ladder)`);
      } catch (err) {
        console.error(`[transcode] ffmpeg failed for ${streamId}:`, (err as Error).message);
      }
    } else {
      console.log(
        `[transcode] no source HLS at ${sourcePlaylistCandidate} — marking stub VOD`
      );
    }
  } else {
    console.log("[transcode] ffmpeg not on PATH — marking stub VOD");
  }

  if (stream.startedAt && stream.endedAt) {
    durationSec = Math.max(
      0,
      Math.floor(
        (new Date(stream.endedAt).getTime() - new Date(stream.startedAt).getTime()) /
          1000
      )
    );
  }

  db.insert(schema.vods)
    .values({
      id: vodId,
      streamId,
      title: `${stream.title} — VOD`,
      description: stream.description,
      gameId: stream.gameId,
      durationSec,
      hlsPath,
      mp4Path,
      thumbnailUrl: stream.thumbnailUrl,
      publishedAt: new Date().toISOString(),
      chapters: [],
      viewCount: 0,
      likeCount: 0,
      isPremium: stream.isPremium,
    })
    .run();

  return vodId;
}

export function registerTranscodeWorker() {
  if (registered) return;
  registered = true;
  subscribe("stream:enqueue-transcode", (payload) => {
    const streamId = (payload as { streamId?: string })?.streamId;
    if (!streamId) return;
    queue
      .add(async () => {
        try {
          await transcodeStreamToVod(streamId);
        } catch (err) {
          console.error("[transcode] worker error:", err);
        }
      })
      .catch((err) => console.error("[transcode] queue error:", err));
  });
  console.log("[transcode] worker registered — listening on stream:enqueue-transcode");
}

// Auto-register on first import (instrumentation.ts may not fire under Turbopack dev).
if (typeof process !== "undefined" && process.env.NEXT_RUNTIME !== "edge") {
  registerTranscodeWorker();
}
