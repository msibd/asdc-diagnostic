import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { orderInclude, serializeOrder } from "@/modules/orders/services/order-service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "orders:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const order = await prisma.testOrder.findUnique({ where: { id }, include: orderInclude });
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json({ order: serializeOrder(order) });
}
