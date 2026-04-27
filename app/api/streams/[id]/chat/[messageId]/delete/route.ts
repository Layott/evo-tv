import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
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

  const role = (user as { role?: string }).role ?? "user";
  const isAuthor = row.userId === user.id;
  if (role !== "admin" && !isAuthor) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const deleted = await deleteMessage(messageId);
  if (!deleted) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ ok: true });
}
