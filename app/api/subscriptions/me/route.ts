import { NextResponse } from "next/server";
import { getActiveSubscription } from "@/lib/api/subscriptions";
import { getCurrentUser } from "@/lib/auth/guards";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const sub = await getActiveSubscription(user.id);
  return NextResponse.json({ subscription: sub });
}
