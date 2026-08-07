import { NextResponse, type NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { usingSpaces } from "@/lib/storage";
import { presignPut } from "@/lib/storage/spaces";

// Client uploads bypass the API process entirely, so this is where videos go.
// Vercel's serverless request-body cap (4.5 MB) is what forced this originally;
// on the droplet the reason is simply that a 512 MB video has no business
// occupying a Node process for the duration of the upload.
const MAX_BYTES = 512 * 1024 * 1024; // 512 MB

const ALLOWED_CONTENT_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "image/jpeg",
  "image/png",
  "image/webp",
];

const PATHNAME_PREFIX = "admin-uploads/";

/** Random suffix, mirroring Blob's `addRandomSuffix` so two uploads of the same filename cannot collide. */
function randomSuffix(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function suffixed(pathname: string): string {
  const dot = pathname.lastIndexOf(".");
  if (dot <= pathname.lastIndexOf("/")) return `${pathname}-${randomSuffix()}`;
  return `${pathname.slice(0, dot)}-${randomSuffix()}${pathname.slice(dot)}`;
}

/**
 * POST /api/admin/uploads/client
 *
 * Mints a short-lived direct-upload credential for an admin client. Two
 * backends, selected by env, with deliberately identical response shapes so
 * the RN client needs one code path:
 *
 * **Spaces (SPACES_KEY set).** Request `{ pathname, contentType }`, response
 * `{ type: "presigned-put", uploadUrl, publicUrl, key }`. The client PUTs the
 * bytes at `uploadUrl` with exactly the `Content-Type` it declared, since that
 * header is part of the signature. There is no completion callback: the client
 * already knows the final URL, and persists it via the relevant admin endpoint
 * (POST /api/admin/vods, PATCH /api/admin/streams/[id], ...).
 *
 * **Vercel Blob (legacy, while BLOB_READ_WRITE_TOKEN is still the active
 * store).** The original two-leg token exchange, kept verbatim.
 *
 * Both legs are admin-gated, except Blob's `blob.upload-completed` callback,
 * which cannot carry a session cookie and is instead verified by the
 * `x-vercel-signature` HMAC inside `handleUpload`.
 *
 * On any validation failure: 400 with `{ error }`.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const type = (body as { type?: string })?.type;

  // Admin-gate everything except Blob's server-to-server completion callback.
  if (type !== "blob.upload-completed") {
    const guard = await requireAdminFromRequest();
    if (!guard.ok) return guard.response;
  }

  if (usingSpaces) {
    const { pathname, contentType } = (body ?? {}) as {
      pathname?: string;
      contentType?: string;
    };

    if (!pathname || typeof pathname !== "string") {
      return NextResponse.json({ error: "Missing `pathname`" }, { status: 400 });
    }
    if (!pathname.startsWith(PATHNAME_PREFIX)) {
      return NextResponse.json(
        { error: `pathname must start with "${PATHNAME_PREFIX}"` },
        { status: 400 },
      );
    }
    // Reject traversal before it can escape the admin-uploads namespace.
    if (pathname.includes("..")) {
      return NextResponse.json({ error: "Invalid pathname" }, { status: 400 });
    }
    if (!contentType || !ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: `Unsupported type: ${contentType ?? "none"}` },
        { status: 415 },
      );
    }

    try {
      const signed = await presignPut(suffixed(pathname), contentType);
      return NextResponse.json({
        type: "presigned-put",
        ...signed,
        // Advisory only. A presigned PUT cannot enforce a size limit on its
        // own, so the client pre-checks and the bucket lifecycle/monitoring is
        // the backstop. Enforcing server-side would mean POST policies, which
        // Spaces supports but the RN client does not implement.
        maxBytes: MAX_BYTES,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Presign failed" },
        { status: 400 },
      );
    }
  }

  // ---- legacy Vercel Blob path ----
  try {
    const result = await handleUpload({
      body: body as HandleUploadBody,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(PATHNAME_PREFIX)) {
          throw new Error(`pathname must start with "${PATHNAME_PREFIX}"`);
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true,
        };
      },
      // No-op on purpose: the client receives the blob URL directly from its
      // PUT response. In local dev Vercel Blob cannot reach localhost, so this
      // callback fails silently; nothing depends on it.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Token exchange failed" },
      { status: 400 },
    );
  }
}
