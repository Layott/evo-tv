import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageAdapter } from "./local";

const REGION = process.env.SPACES_REGION ?? "fra1";
const BUCKET = process.env.SPACES_BUCKET ?? "";
const KEY = process.env.SPACES_KEY ?? "";
const SECRET = process.env.SPACES_SECRET ?? "";

/**
 * Any S3-compatible endpoint, defaulting to DigitalOcean's.
 *
 * This exists so the upload path can be exercised without production
 * credentials: point it at a local MinIO and the presign, the browser PUT and
 * the public read all run for real. Unset, nothing about production changes.
 */
const ENDPOINT = (
  process.env.SPACES_ENDPOINT ?? `https://${REGION}.digitaloceanspaces.com`
).replace(/\/+$/, "");

/**
 * Spaces and S3 proper address a bucket as a subdomain. Local servers usually
 * cannot, because `bucket.localhost` does not resolve, so they want the bucket
 * in the path instead.
 */
const FORCE_PATH_STYLE = process.env.SPACES_FORCE_PATH_STYLE === "true";

/**
 * Public read URL base. Prefer the CDN hostname: DO Spaces serves the origin
 * from `<bucket>.<region>.digitaloceanspaces.com` and the CDN edge from
 * `<bucket>.<region>.cdn.digitaloceanspaces.com`, and only the second one is
 * cached. Falling back to the origin keeps things working before the CDN is
 * switched on, at the cost of egress.
 */
function defaultPublicBase(): string {
  if (process.env.SPACES_ENDPOINT) {
    // Whatever style the client is signing with, the readable URL has to match.
    return FORCE_PATH_STYLE
      ? `${ENDPOINT}/${BUCKET}`
      : ENDPOINT.replace("://", `://${BUCKET}.`);
  }
  return `https://${BUCKET}.${REGION}.digitaloceanspaces.com`;
}

const PUBLIC_BASE = (process.env.SPACES_CDN_URL ?? defaultPublicBase()).replace(
  /\/+$/,
  "",
);

function ensureConfigured(): void {
  if (!BUCKET || !KEY || !SECRET) {
    throw new Error(
      "Spaces not configured. Expected SPACES_BUCKET, SPACES_KEY and SPACES_SECRET.",
    );
  }
}

let client: S3Client | undefined;
function s3(): S3Client {
  ensureConfigured();
  client ??= new S3Client({
    region: REGION,
    endpoint: ENDPOINT,
    credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
    // Spaces is virtual-host style, same as S3 proper. Only a local stand-in
    // asks for path style.
    forcePathStyle: FORCE_PATH_STYLE,
  });
  return client;
}

/** Strip any leading slash so a key never becomes an empty first path segment. */
function normalize(relativePath: string): string {
  return relativePath.replace(/^\/+/, "");
}

/**
 * S3 stores an object as binary/octet-stream when PutObject carries no
 * ContentType, which makes browsers download an image instead of rendering it.
 * Vercel Blob inferred this from the pathname, so infer it here too and keep
 * the StorageAdapter.write signature unchanged.
 */
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m3u8: "application/vnd.apple.mpegurl",
  ts: "video/mp2t",
  json: "application/json",
  txt: "text/plain",
};

function contentTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function isNotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e?.name === "NotFound" || e?.name === "NoSuchKey" || e?.$metadata?.httpStatusCode === 404;
}

/**
 * DigitalOcean Spaces adapter. Mirrors the StorageAdapter shape from ./local
 * and the Vercel Blob adapter it replaces, including the two shape quirks that
 * call sites already depend on:
 *
 * - `write` returns the public URL rather than the relative path, because that
 *   is what every caller persists to the database.
 * - `signedUrl` returns the plain public URL. Media objects are world-readable
 *   by design (RN's <Image> fetches them on every device with no auth header),
 *   and StorageAdapter.signedUrl is synchronous while S3 presigning is not.
 *   For genuinely private objects use `presignGet` below.
 */
export const spacesStorage: StorageAdapter = {
  async write(relativePath, data) {
    const Key = normalize(relativePath);
    await s3().send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key,
        Body: typeof data === "string" ? Buffer.from(data) : data,
        ContentType: contentTypeFor(Key),
        ACL: "public-read",
      }),
    );
    return `${PUBLIC_BASE}/${Key}`;
  },

  async read(relativePath) {
    const res = await s3().send(
      new GetObjectCommand({ Bucket: BUCKET, Key: normalize(relativePath) }),
    );
    const bytes = await res.Body!.transformToByteArray();
    return Buffer.from(bytes);
  },

  async delete(relativePath) {
    // DeleteObject is idempotent on S3: a missing key is a 204, not an error.
    await s3().send(
      new DeleteObjectCommand({ Bucket: BUCKET, Key: normalize(relativePath) }),
    );
  },

  async exists(relativePath) {
    try {
      await s3().send(
        new HeadObjectCommand({ Bucket: BUCKET, Key: normalize(relativePath) }),
      );
      return true;
    } catch (err) {
      if (isNotFound(err)) return false;
      throw err;
    }
  },

  url(relativePath) {
    return `${PUBLIC_BASE}/${normalize(relativePath)}`;
  },

  signedUrl(relativePath) {
    return this.url(relativePath);
  },

  verifySigned() {
    // No HMAC scheme: public objects are CDN-reachable and the unique key is
    // the only secret, same contract as the Blob adapter this replaces.
    return true;
  },
};

/** Public URL for a key, without needing the adapter instance. */
export function publicUrl(relativePath: string): string {
  return `${PUBLIC_BASE}/${normalize(relativePath)}`;
}

/**
 * Presigned PUT for direct browser / RN uploads. Replaces the Vercel Blob
 * client-token exchange: the client PUTs raw bytes straight at `uploadUrl`
 * with the exact `Content-Type` it was signed for, bypassing the API process
 * entirely so large videos never traverse it.
 *
 * `contentType` is part of the signature, so a client cannot sign for an image
 * and then upload a different type.
 */
export async function presignPut(
  relativePath: string,
  contentType: string,
  expiresInSec = 600,
): Promise<{
  uploadUrl: string;
  publicUrl: string;
  key: string;
  headers: Record<string, string>;
}> {
  const Key = normalize(relativePath);
  const uploadUrl = await getSignedUrl(
    s3(),
    new PutObjectCommand({
      Bucket: BUCKET,
      Key,
      ContentType: contentType,
      ACL: "public-read",
    }),
    { expiresIn: expiresInSec },
  );
  return {
    uploadUrl,
    publicUrl: `${PUBLIC_BASE}/${Key}`,
    key: Key,
    // Both headers are part of the signature, so the client must send them
    // back verbatim or S3 answers SignatureDoesNotMatch. Handing them over
    // explicitly keeps that rule on this side of the wire.
    headers: { "Content-Type": contentType, "x-amz-acl": "public-read" },
  };
}

/** Presigned GET, for objects that should not be world-readable. */
export async function presignGet(relativePath: string, expiresInSec = 3600): Promise<string> {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: BUCKET, Key: normalize(relativePath) }),
    { expiresIn: expiresInSec },
  );
}

/** Mirrors `listBlobs` from the Blob adapter, for the one-shot migration script. */
export async function listSpaces(prefix?: string) {
  return s3().send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix }));
}
