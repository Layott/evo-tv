import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { listMyPicks } from "@/lib/api/predictions";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const rows = await listMyPicks(user.id, 200);
  return NextResponse.json(rows);
}
