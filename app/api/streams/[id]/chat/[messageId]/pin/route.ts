import { NextResponse, type NextRequest } from "next/server";
import { requireMinRole } from "@/lib/auth/guards";
import { getMessageById, pinMessage } from "@/lib/api/chat";

export async function POST(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; messageId: string }> }
) {
  /*
   * `role !== "admin"` was the test here, and it is false for a head_admin and
   * for the moderators this action exists for, so the two people most likely to
   * be moderating a live chat were the two who could not. The ladder answers
   * this properly: moderator and everything above it.
   */
  const guard = await requireMinRole("moderator");
  if (!guard.ok) return guard.response;

  const { id, messageId } = await params;
  const row = await getMessageById(messageId);
  if (!row || row.streamId !== id) {
    return new NextResponse("Not found", { status: 404 });
  }

  const result = await pinMessage(messageId);
  if (!result) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(result);
}
