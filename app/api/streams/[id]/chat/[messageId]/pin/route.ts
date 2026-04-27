import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { getMessageById, pinMessage } from "@/lib/api/chat";

export async function POST(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; messageId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const role = (user as { role?: string }).role ?? "user";
  if (role !== "admin") {
    return new NextResponse("Admin required", { status: 403 });
  }

  const { id, messageId } = await params;
  const row = await getMessageById(messageId);
  if (!row || row.streamId !== id) {
    return new NextResponse("Not found", { status: 404 });
  }

  const result = await pinMessage(messageId);
  if (!result) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(result);
}
