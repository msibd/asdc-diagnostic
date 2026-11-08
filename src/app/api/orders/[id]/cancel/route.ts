import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { reasonSchema } from "@/modules/orders/schemas/order-schema";
import { auditFor, orderErrorResponse, readJson } from "@/modules/orders/services/order-http";
import { cancelOrder, orderInclude, serializeOrder } from "@/modules/orders/services/order-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "orders:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = reasonSchema.safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "A reason is required." }, { status: 400 });
  const { id } = await params;
  try {
    await cancelOrder(id, parsed.data.reason, auditFor(request, access.session.user.id));
    const order = await prisma.testOrder.findUniqueOrThrow({ where: { id }, include: orderInclude });
    return NextResponse.json({ order: serializeOrder(order) });
  } catch (error) {
    return orderErrorResponse(error);
  }
}
