import { NextResponse } from "next/server";
import { getProductById, getProductBySlug } from "@/lib/api/products";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // Support both id and slug lookup for convenience.
  const product = (await getProductById(id)) ?? (await getProductBySlug(id));
  if (!product) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(product);
}
