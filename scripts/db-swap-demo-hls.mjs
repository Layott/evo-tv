import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env.local") });

const URL =
  process.env.DATABASE_URL_UNPOOLED ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL;
const sql = neon(URL);

// Public test HLS that auto-plays. Same stream multi-stream/watch-parties
// fall back to. Replaces /demo/sample.m3u8 stubs so videos actually play.
const TEST_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";
const TEST_MP4 =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4";

const r1 = await sql`
  UPDATE streams
  SET hls_url = ${TEST_HLS}
  WHERE hls_url IN ('/demo/sample.m3u8', '', 'demo/sample.m3u8')
  RETURNING id`;
console.log("streams updated:", r1.length);

const r2 = await sql`
  UPDATE vods
  SET hls_path = ${TEST_HLS}, mp4_path = ${TEST_MP4}
  WHERE hls_path IN ('/demo/sample.m3u8', '', 'demo/sample.m3u8')
     OR mp4_path IN ('/demo/sample.mp4', '', 'demo/sample.mp4')
  RETURNING id`;
console.log("vods updated:", r2.length);

const r3 = await sql`
  UPDATE clips
  SET hls_path = ${TEST_HLS}, mp4_path = ${TEST_MP4}
  WHERE hls_path IN ('/demo/sample.m3u8', '', 'demo/sample.m3u8')
     OR mp4_path IN ('/demo/sample.mp4', '', 'demo/sample.mp4')
  RETURNING id`;
console.log("clips updated:", r3.length);

const r4 = await sql`
  UPDATE episodes
  SET hls_url = ${TEST_HLS}
  WHERE hls_url IN ('/demo/sample.m3u8', '', 'demo/sample.m3u8')
  RETURNING id`;
console.log("episodes updated:", r4.length);
