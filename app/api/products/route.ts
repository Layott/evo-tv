import { NextResponse, type NextRequest } from "next/server";
import { listProducts } from "@/lib/api/products";
import type { Product } from "@/lib/types";

const VALID_CATEGORIES: Product["category"][] = [
  "jersey",
  "apparel",
  "accessory",
  "digital",
  "collectible",
];

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const featuredParam = params.get("featured");
  const categoryParam = params.get("category");
  const teamIdParam = params.get("teamId");

  const filter: Parameters<typeof listProducts>[0] = {};
  if (featuredParam !== null) {
    filter.featured = featuredParam === "1" || featuredParam === "true";
  }
  if (
    categoryParam &&
    (VALID_CATEGORIES as string[]).includes(categoryParam)
  ) {
    filter.category = categoryParam as Product["category"];
  }
  if (teamIdParam) filter.teamId = teamIdParam;

  return NextResponse.json(await listProducts(filter));
}
