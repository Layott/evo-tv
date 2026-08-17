import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db, schema } from "@/lib/db";
import { generateId, requireAdminFromRequest } from "@/lib/api/admin";
import { listReleases, type ReleasePlatform } from "@/lib/api/app-releases";

/**
 * The builds offered on /apps.
 *
 * Publishing is an API call rather than an environment variable, which is the
 * whole point: `NEXT_PUBLIC_ANDROID_APK_URL` is inlined at image build time, so
 * pointing it at a new APK meant redeploying the website, and the page could
 * never say which version it was handing out. A row here is live immediately.
 *
 * The binary is not uploaded through this route. It goes straight to Spaces via
 * the presigned URL from `/api/admin/uploads/client`, and this records where it
 * landed. Streaming 100 MB through a Node process to write it somewhere else
 * would tie up the API for the duration of every upload.
 */

const bodySchema = z.object({
  platform: z.enum(["android", "ios"]),
  version: z.string().min(1),
  buildNumber: z.number().int().positive(),
  commitSha: z.string().min(4),
  fileUrl: z.string().url(),
  sizeBytes: z.number().int().positive(),
  notes: z.string().max(2000).optional(),
});

export async function GET(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  const raw = new URL(req.url).searchParams.get("platform") ?? "android";
  if (raw !== "android" && raw !== "ios") {
    return NextResponse.json({ error: "unknown platform" }, { status: 422 });
  }
  return NextResponse.json({
    releases: await listReleases(raw as ReleasePlatform),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminFromRequest();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const row = {
    id: generateId("rel"),
    ...parsed.data,
    notes: parsed.data.notes ?? null,
    releasedAt: new Date().toISOString(),
  };

  // Publishing the same build twice is a re-run of the build script, not an
  // error worth failing a release pipeline over. The newer row wins on
  // released_at and the download URL is the same file either way.
  await db.insert(schema.appReleases).values(row);

  return NextResponse.json({ release: row }, { status: 201 });
}
