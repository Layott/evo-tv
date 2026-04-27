import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { closePoll } from "@/lib/api/polls";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });
  const role = (user as { role?: string }).role ?? "user";
  if (role !== "admin") return new NextResponse("Admin required", { status: 403 });

  const { id } = await params;
  const poll = await closePoll(id);
  if (!poll) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json({ poll });
}
