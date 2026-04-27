import { NextResponse } from "next/server";
import { getStreamById } from "@/lib/api/streams";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stream = await getStreamById(id);
  if (!stream) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(stream);
}
