/**
 * Teach the Spaces bucket to accept an upload from a browser.
 *
 * The admin dashboard uploads straight to the bucket with a presigned PUT, so
 * the request never touches the API and the bucket, not the app, decides
 * whether to allow it. Without a CORS rule the browser refuses before it sends
 * a byte, and the only symptom is a failed fetch with no useful message.
 *
 * This was the state of production on 2026-08-16: a preflight for
 * `https://evotv.co` came back 403 with no `Access-Control-Allow-Origin`, so
 * every upload from the dashboard would have failed even though the presign
 * itself was correct.
 *
 * Run it on the droplet, where the credentials live:
 *
 *     cd /srv/evotv/api && node deploy/spaces-cors.mjs
 *
 * Reads SPACES_REGION, SPACES_BUCKET, SPACES_KEY and SPACES_SECRET from the
 * environment, and prints the rules back after writing them. Idempotent:
 * PutBucketCors replaces the whole configuration every time.
 */
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from "@aws-sdk/client-s3";
import fs from "node:fs";

// The droplet keeps its secrets in a file next to the app rather than in the
// shell, so read that when the variables are not already exported.
const ENV_FILE = process.env.ENV_FILE ?? "/srv/evotv/api/.env.production";
if (!process.env.SPACES_KEY && fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1");
    }
  }
}

const REGION = process.env.SPACES_REGION ?? "fra1";
const BUCKET = process.env.SPACES_BUCKET;
const KEY = process.env.SPACES_KEY;
const SECRET = process.env.SPACES_SECRET;

if (!BUCKET || !KEY || !SECRET) {
  console.error(
    "Missing SPACES_BUCKET, SPACES_KEY or SPACES_SECRET. Run this where the production env file is, or export them first.",
  );
  process.exit(1);
}

/**
 * Only the origins that actually run the dashboard. A wildcard would let any
 * site on the internet spend a signature it somehow obtained, and the presign
 * is handed to the browser, so it is not as unreachable as it sounds.
 */
const ORIGINS = [
  "https://evotv.co",
  "https://www.evotv.co",
  "https://app.evotv.co",
  "http://localhost:3060",
];

const s3 = new S3Client({
  region: REGION,
  endpoint: `https://${REGION}.digitaloceanspaces.com`,
  credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
});

await s3.send(
  new PutBucketCorsCommand({
    Bucket: BUCKET,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ORIGINS,
          // PUT is the upload. GET and HEAD matter because the app reads media
          // back with fetch in a few places, and a canvas read is tainted
          // without them.
          AllowedMethods: ["GET", "HEAD", "PUT"],
          // Content-Type and x-amz-acl are part of the signature, so the
          // browser must be allowed to send both.
          AllowedHeaders: ["*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 3000,
        },
      ],
    },
  }),
);

const now = await s3.send(new GetBucketCorsCommand({ Bucket: BUCKET }));
console.log(`CORS set on ${BUCKET}:`);
console.log(JSON.stringify(now.CORSRules, null, 2));
