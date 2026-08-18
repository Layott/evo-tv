import { NextResponse } from "next/server";

import { getStreamById } from "@/lib/api/streams";
import { getCurrentUser } from "@/lib/auth/guards";
import { resolveViewer, stripPlayback } from "@/lib/api/playback";
import { stripViewerCount } from "@/lib/api/counts";

/**
 * A stream's public record. The playback URL is not part of it.
 *
 * Watching requires an account, so `hlsUrl` is withheld from a signed-out
 * caller. That is enforced here rather than only in the player, because a UI
 * gate is a suggestion: the manifest URL was in the JSON, so anyone could read
 * it out of the network tab and open it directly, and the sign-in wall would
 * have been decoration.
 *
 * Everything else stays public on purpose. Title, thumbnail, streamer and live
 * state are what a shared link needs to render a preview and what a search
 * engine needs to index the page, and none of it is the broadcast itself.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const stream = await getStreamById(id);
  if (!stream) return new NextResponse("Not found", { status: 404 });

  const viewer = await resolveViewer();
  return NextResponse.json(
    stripViewerCount(stripPlayback(stream, viewer.signedIn), viewer.admin),
  );
}
