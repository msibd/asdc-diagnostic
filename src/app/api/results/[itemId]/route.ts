import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { saveResultsSchema } from "@/modules/orders/schemas/order-schema";
import { auditFor, orderErrorResponse, readJson } from "@/modules/orders/services/order-http";
import { orderInclude, serializeOrder } from "@/modules/orders/services/order-service";
import { loadResultSheet, saveResults } from "@/modules/orders/services/result-service";

/** Saves the results of one test. Returns the refreshed sheet and order so the screen can redraw. */
export async function PUT(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const access = await authorize(request.headers, "results:enter");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = saveResultsSchema.safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid results." }, { status: 400 });
  const { itemId } = await params;
  try {
    const orderId = await saveResults(itemId, parsed.data, access.session.user.name, auditFor(request, access.session.user.id));
    const [sheet, order] = await Promise.all([loadResultSheet(orderId), prisma.testOrder.findUniqueOrThrow({ where: { id: orderId }, include: orderInclude })]);
    return NextResponse.json({ sheet, order: serializeOrder(order) });
  } catch (error) {
    return orderErrorResponse(error);
  }
}
