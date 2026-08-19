import { NextResponse, type NextRequest } from "next/server";
import { requireCapability } from "@/lib/api/admin";
import { ingestDetailsFor } from "@/lib/video/ingest";

/**
 * GET /api/admin/streams/[id]/ingest - what to put in OBS.
 *
 * Create returns these once. An operator who closed that dialog, or who is
 * setting up a second encoder, previously had no way back to them. Cloudflare
 * stores its own stream key and will hand it back, so for a Cloudflare stream
 * this is complete. For the self-hosted path only the server URL comes back:
 * our key is stored as a hash and genuinely cannot be recovered, which the
 * response says rather than inventing something that looks like a key.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireCapability("broadcast");
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const details = await ingestDetailsFor(id);
  if (!details) {
    return NextResponse.json({ error: "Stream not found" }, { status: 404 });
  }
  return NextResponse.json({ ingest: details });
}
