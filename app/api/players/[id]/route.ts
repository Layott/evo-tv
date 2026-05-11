import { NextResponse, type NextRequest } from "next/server";
import { getPlayerById } from "@/lib/api/players";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json(await getPlayerById(id));
}
