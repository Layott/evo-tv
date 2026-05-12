import { NextResponse, type NextRequest } from "next/server";
import { listDrops } from "@/lib/api/rewards";

const VALID_KINDS = ["cosmetic", "premium-trial", "merch-voucher"] as const;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const kind = params.get("kind");
  const category = params.get("category");
  const filter: Parameters<typeof listDrops>[0] = {};
  if (kind && (VALID_KINDS as readonly string[]).includes(kind)) {
    filter.kind = kind as (typeof VALID_KINDS)[number];
  }
  if (category) filter.category = category;
  return NextResponse.json(await listDrops(filter));
}
