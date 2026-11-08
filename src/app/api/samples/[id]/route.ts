import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { sampleActionSchema } from "@/modules/orders/schemas/order-schema";
import { auditFor, orderErrorResponse, readJson } from "@/modules/orders/services/order-http";
import { changeSample, orderInclude, serializeOrder } from "@/modules/orders/services/order-service";

/** Collect, receive or reject one sample. Returns the whole order so the screen can redraw it. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "samples:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = sampleActionSchema.safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { id } = await params;
  try {
    const { orderId } = await changeSample(id, parsed.data, access.session.user.name, auditFor(request, access.session.user.id));
    const order = await prisma.testOrder.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
    return NextResponse.json({ order: serializeOrder(order) });
  } catch (error) {
    return orderErrorResponse(error);
  }
}
