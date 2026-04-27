import { NextResponse } from "next/server";
import { publicKey } from "@/lib/push";

export async function GET() {
  const key = publicKey();
  if (!key) return new NextResponse("VAPID not configured", { status: 503 });
  return NextResponse.json({ publicKey: key });
}
