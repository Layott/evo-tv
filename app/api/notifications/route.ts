import { NextResponse } from "next/server";
import {
  listNotifications,
  countUnread,
  markAllAsRead,
} from "@/lib/api/notifications";
import { getCurrentUser } from "@/lib/auth/guards";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const [items, unread] = await Promise.all([
    listNotifications(user.id),
    countUnread(user.id),
  ]);
  return NextResponse.json({ items, unread });
}

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  await markAllAsRead(user.id);
  return NextResponse.json({ ok: true });
}
