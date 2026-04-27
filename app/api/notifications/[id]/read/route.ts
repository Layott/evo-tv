import { NextResponse } from "next/server";
import { markAsRead } from "@/lib/api/notifications";
import { getCurrentUser } from "@/lib/auth/guards";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const { id } = await params;
  await markAsRead(id);
  return NextResponse.json({ ok: true });
}
