import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { getXpAndTier } from "@/lib/api/rewards";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  return NextResponse.json(await getXpAndTier(user.id));
}
