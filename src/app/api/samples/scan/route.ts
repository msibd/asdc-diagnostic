import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { scanSchema } from "@/modules/orders/schemas/order-schema";
import { auditFor, orderErrorResponse, readJson } from "@/modules/orders/services/order-http";
import { orderInclude, receiveByCode, serializeOrder } from "@/modules/orders/services/order-service";

/** The lab scans a sample's barcode to mark it received. */
export async function POST(request: Request) {
  const access = await authorize(request.headers, "samples:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = scanSchema.safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Scan or type a sample code." }, { status: 400 });
  try {
    const { orderId, sampleCode } = await receiveByCode(parsed.data.code, access.session.user.name, auditFor(request, access.session.user.id));
    const order = await prisma.testOrder.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude });
    return NextResponse.json({ order: serializeOrder(order), sampleCode });
  } catch (error) {
    return orderErrorResponse(error);
  }
}
