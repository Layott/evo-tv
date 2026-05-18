import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { getMyApplication } from "@/lib/api/creator-program";

/** GET /api/creator-program/me — caller's own application or null. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  return NextResponse.json(await getMyApplication(user.id));
}
