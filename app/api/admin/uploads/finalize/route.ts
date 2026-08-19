import { NextResponse, type NextRequest } from "next/server";
import { requireAdminFromRequest } from "@/lib/api/admin";
import { usingSpaces } from "@/lib/storage";
import { makePublic } from "@/lib/storage/spaces";

/**
 * POST /api/admin/uploads/finalize  { key }
 *
 * The step that was missing between "the browser finished uploading" and "the
 * URL was saved to a row".
 *
 * The presigned PUT asks for `public-read`, hoisted into the query string, and
 * the bucket did not apply it. Every CMS upload therefore landed private: the
 * stream thumbnail answered `AccessDenied` on the CDN and on the origin, the
 * dashboard drew a broken image, and nothing anywhere reported a failure,
 * because the upload itself had succeeded.
 *
 * Setting the ACL from the server is not subject to that, and the read-back is
 * the point: this refuses to call an upload finished until the file has
 * actually been fetched over the public URL.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  if (!usingSpaces) {
    return NextResponse.json(
      { error: "Uploads are not configured on this deployment" },
      { status: 503 },
    );
  }

  const { key } = ((await req.json().catch(() => ({}))) ?? {}) as {
    key?: string;
  };
  if (!key || typeof key !== "string" || key.includes("..")) {
    return NextResponse.json({ error: "Missing `key`" }, { status: 400 });
  }
  if (!key.startsWith("admin-uploads/") && !key.startsWith("downloads/")) {
    return NextResponse.json({ error: "Key outside the upload namespace" }, { status: 400 });
  }

  try {
    const result = await makePublic(key);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not publish the file" },
      { status: 502 },
    );
  }
}
