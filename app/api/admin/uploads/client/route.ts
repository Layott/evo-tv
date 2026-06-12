import { NextResponse, type NextRequest } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireAdminFromRequest } from "@/lib/api/admin";

// Client uploads bypass the serverless request-body cap (3.5 MB pre-check in
// the RN client, 4.5 MB platform hard cap), so this is where videos go.
// The client PUTs the file straight to Vercel Blob using a short-lived client
// token minted here. Token constraints (types, size, suffix) are enforced by
// the Blob API itself; the client cannot widen them.
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

/**
 * POST /api/admin/uploads/client
 *
 * Vercel Blob client-upload token exchange. Two event types arrive on this
 * route (discriminated by `body.type`):
 *
 * 1. "blob.generate-client-token" — sent by the RN/web client (via
 *    `upload()` from `@vercel/blob/client`, or the raw protocol). Admin-gated.
 *    Responds `{ type, clientToken }`.
 * 2. "blob.upload-completed" — sent by Vercel Blob's servers after the upload
 *    finishes. This leg can never carry an admin session cookie; it is
 *    authenticated instead by the `x-vercel-signature` HMAC, which
 *    `handleUpload` verifies against BLOB_READ_WRITE_TOKEN before invoking
 *    `onUploadCompleted`. Responds `{ type, response: "ok" }`.
 *
 * On any validation or signature failure: 400 with `{ error }`.
 */
export async function POST(req: NextRequest) {
  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Admin-gate the token-generation leg (the one a human client calls).
  // The upload-completed callback leg comes from Vercel Blob's infrastructure
  // and is verified via HMAC signature inside handleUpload instead.
  if (body?.type !== "blob.upload-completed") {
    const guard = await requireAdminFromRequest();
    if (!guard.ok) return guard.response;
  }

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Keep all admin media under one namespace, same as the small-file
        // route (app/api/admin/uploads/route.ts).
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
      // PUT response and then persists it via the relevant admin endpoint
      // (POST /api/admin/vods, PATCH /api/admin/streams/[id], ...). Note that
      // in local dev Vercel Blob cannot reach localhost, so this callback
      // fails silently; that is acceptable since nothing depends on it.
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
