import { NextResponse } from "next/server";
import { listTiers } from "@/lib/api/tiers";

export async function GET() {
  return NextResponse.json(listTiers());
}
