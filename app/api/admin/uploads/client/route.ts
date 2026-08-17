import { NextResponse, type NextRequest } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { usingSpaces } from "@/lib/storage";
import { presignPut } from "@/lib/storage/spaces";

// Client uploads bypass the API process entirely, so this is where videos go.
// Vercel's serverless request-body cap (4.5 MB) is what forced this originally;
// on the droplet the reason is simply that a 512 MB video has no business
// occupying a Node process for the duration of the upload.
const MAX_BYTES = 512 * 1024 * 1024; // 512 MB

const ALLOWED_CONTENT_TYPES = [
  // The Android build. Here so a release can be published from whichever
  // machine ran the build, without putting Spaces credentials on it.
  "application/vnd.android.package-archive",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "image/jpeg",
  "image/png",
  "image/webp",
];

/**
 * Where an admin upload is allowed to land.
 *
 * `admin-uploads/` is the general namespace for anything the CMS uploads. It
 * exists so a presigned PUT cannot be pointed at an arbitrary key in the bucket.
 *
 * `downloads/` is for release binaries, and it is separate because the URL is
 * user-facing: the Android build is linked from /apps, so people see it, paste
 * it and share it. `admin-uploads/downloads/evotv-0.1.0.apk` invites the
 * question of why the public is being handed something labelled admin. The
 * previously hosted APK already lives under `downloads/`, so this also keeps one
 * home for release artifacts rather than two.
 *
 * Adding the APK content type without adding this prefix is what made the whole
 * publish path unreachable: the script asked for `downloads/<name>` and got a
 * 400 back, so no release was ever published.
 */
const PATHNAME_PREFIXES = ["admin-uploads/", "downloads/"] as const;

/** Random suffix so two uploads of the same filename cannot collide. */
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
 * GET /api/admin/uploads/client - whether this deployment can accept uploads.
 *
 * `configured` is false when there are no Spaces credentials, which is the
 * ordinary state of a local checkout. The upload field then says so and falls
 * back to pasting a URL, rather than offering a picker that cannot work.
 *
 * `backend` is still reported, and still says "spaces", because both clients
 * switch on it. It has one possible value now that the Vercel Blob path is
 * gone.
 */
export async function GET() {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    backend: "spaces",
    configured: usingSpaces,
    maxBytes: MAX_BYTES,
    allowedContentTypes: ALLOWED_CONTENT_TYPES,
  });
}

/**
 * POST /api/admin/uploads/client
 *
 * Mints a short-lived direct-upload credential. Request
 * `{ pathname, contentType }`, response
 * `{ type: "presigned-put", uploadUrl, publicUrl, key }`. The client PUTs the
 * bytes at `uploadUrl` with exactly the `Content-Type` it declared, since that
 * header is part of the signature. There is no completion callback: the client
 * already knows the final URL and persists it through the relevant admin
 * endpoint (POST /api/admin/vods, PATCH /api/admin/streams/[id], ...).
 *
 * The bucket must allow the browser's origin, or the PUT never leaves it. See
 * `deploy/spaces-cors.mjs`.
 *
 * On any validation failure: 400 with `{ error }`.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!usingSpaces) {
    return NextResponse.json(
      { error: "Uploads are not configured on this deployment" },
      { status: 503 },
    );
  }

  const { pathname, contentType } = (body ?? {}) as {
    pathname?: string;
    contentType?: string;
  };

  if (!pathname || typeof pathname !== "string") {
    return NextResponse.json({ error: "Missing `pathname`" }, { status: 400 });
  }
  if (!PATHNAME_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.json(
      {
        error: `pathname must start with one of: ${PATHNAME_PREFIXES.map(
          (p) => `"${p}"`,
        ).join(", ")}`,
      },
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
      // Advisory only. A presigned PUT cannot enforce a size limit on its own,
      // so the client pre-checks and the bucket lifecycle is the backstop.
      maxBytes: MAX_BYTES,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Presign failed" },
      { status: 400 },
    );
  }
}
