import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { hasMinRole, type PlatformRole } from "@/lib/auth/roles";
import { deleteMessage, getMessageById } from "@/lib/api/chat";

export async function POST(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; messageId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const { id, messageId } = await params;
  const row = await getMessageById(messageId);
  if (!row || row.streamId !== id) {
    return new NextResponse("Not found", { status: 404 });
  }

  /*
   * Authors delete their own line, moderators delete anybody's.
   *
   * The test was `role !== "admin"`, which is false for a head_admin and for
   * the moderators this exists for, so the trash button in the chat answered
   * 403 to the two roles most likely to be pressing it.
   */
  const role = ((user as { role?: string }).role ?? "user") as PlatformRole;
  const isAuthor = row.userId === user.id;
  if (!isAuthor && !hasMinRole(role, "moderator")) {
    return new NextResponse(`Requires moderator role (you are ${role})`, {
      status: 403,
    });
  }

  const deleted = await deleteMessage(messageId);
  if (!deleted) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ ok: true });
}
