import { NextResponse, type NextRequest } from "next/server";

import { getLatestRelease, type ReleasePlatform } from "@/lib/api/app-releases";

/**
 * GET /api/app/releases/latest?platform=android
 *
 * Public: this is what the download page reads, and a visitor deciding whether
 * to install the app has not signed in yet.
 *
 * Answers 200 with `{ release: null }` rather than 404 when nothing is
 * published. "No build yet" is a normal state for this product and the page has
 * honest copy for it; a 404 would make the page treat a working server as
 * broken.
 */
export async function GET(req: NextRequest) {
  const raw = new URL(req.url).searchParams.get("platform") ?? "android";
  if (raw !== "android" && raw !== "ios") {
    return NextResponse.json(
      { error: "platform must be android or ios" },
      { status: 422 },
    );
  }

  const release = await getLatestRelease(raw as ReleasePlatform);

  return NextResponse.json(
    { release },
    {
      // Short enough that a fresh build is downloadable within a minute, long
      // enough that the download page does not query on every page view.
      headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
    },
  );
}
