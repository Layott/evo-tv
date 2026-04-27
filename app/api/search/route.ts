import { NextResponse, type NextRequest } from "next/server";
import { globalSearch, searchSuggestions } from "@/lib/api/search";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const suggest = searchParams.get("suggest") === "1";

  if (suggest) {
    const limit = Number.parseInt(searchParams.get("limit") ?? "8", 10);
    return NextResponse.json(await searchSuggestions(q, limit));
  }

  return NextResponse.json(await globalSearch(q));
}
