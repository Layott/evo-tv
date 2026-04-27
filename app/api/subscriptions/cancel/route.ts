import { NextResponse } from "next/server";
import { cancelSubscription } from "@/lib/api/subscriptions";
import { getCurrentUser } from "@/lib/auth/guards";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  await cancelSubscription(user.id);
  return NextResponse.json({ ok: true });
}
