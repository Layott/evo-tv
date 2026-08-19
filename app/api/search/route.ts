import { NextResponse, type NextRequest } from "next/server";
import { globalSearch, searchSuggestions } from "@/lib/api/search";
import { resolveViewer } from "@/lib/api/playback";
import { stripViewCountAll, stripViewerCountAll } from "@/lib/api/counts";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const suggest = searchParams.get("suggest") === "1";

  if (suggest) {
    const limit = Number.parseInt(searchParams.get("limit") ?? "8", 10);
    return NextResponse.json(await searchSuggestions(q, limit));
  }

  // Search returns whole stream, VOD and event rows, so it leaks audience
  // numbers just as readily as the endpoints those rows came from.
  const viewer = await resolveViewer();
  const results = await globalSearch(q);
  return NextResponse.json({
    ...results,
    streams: stripViewerCountAll(results.streams, viewer.admin),
    events: stripViewerCountAll(results.events, viewer.admin),
    vods: stripViewCountAll(results.vods, viewer.admin),
  });
}
