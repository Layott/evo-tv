import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { getOrderById } from "@/lib/api/orders";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Auth required", { status: 401 });

  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) return new NextResponse("Not found", { status: 404 });

  const role = (user as { role?: string }).role ?? "user";
  if (order.userId !== user.id && role !== "admin") {
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.json(order);
}
