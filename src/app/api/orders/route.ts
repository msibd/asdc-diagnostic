import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { createOrderSchema } from "@/modules/orders/schemas/order-schema";
import { auditFor, orderErrorResponse, readJson } from "@/modules/orders/services/order-http";
import { createOrder, listOrders, orderInclude, serializeOrder } from "@/modules/orders/services/order-service";

export async function GET(request: Request) {
  const access = await authorize(request.headers, "orders:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const params = new URL(request.url).searchParams;
  const cursor = z.string().min(1).max(100).safeParse(params.get("cursor") ?? undefined);
  if (params.has("cursor") && !cursor.success) return NextResponse.json({ error: "Invalid order cursor." }, { status: 400 });
  const result = await listOrders({
    search: (params.get("search") ?? "").trim().slice(0, 100),
    status: params.get("status") ?? "OPEN",
    cursor: cursor.success ? cursor.data : undefined,
  });
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "orders:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = createOrderSchema.safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid order." }, { status: 400 });
  try {
    const id = await createOrder(parsed.data, auditFor(request, access.session.user.id));
    const order = await prisma.testOrder.findUniqueOrThrow({ where: { id }, include: orderInclude });
    return NextResponse.json({ order: serializeOrder(order) }, { status: 201 });
  } catch (error) {
    return orderErrorResponse(error);
  }
}
