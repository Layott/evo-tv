import { NextResponse, type NextRequest } from "next/server";
import { getTeamById } from "@/lib/api/teams";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await getTeamById(id));
}
