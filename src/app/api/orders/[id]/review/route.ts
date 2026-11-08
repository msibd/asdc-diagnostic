import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { reviewSchema } from "@/modules/orders/schemas/order-schema";
import { auditFor, orderErrorResponse, readJson } from "@/modules/orders/services/order-http";
import { orderInclude, serializeOrder } from "@/modules/orders/services/order-service";
import { loadResultSheet, reviewResults } from "@/modules/orders/services/result-service";

/** The pathologist approves results (one test, or all that are waiting) or sends a test back with a reason. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "results:verify");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = reviewSchema.safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { id } = await params;
  try {
    await reviewResults(id, parsed.data, access.session.user.name, auditFor(request, access.session.user.id));
    const [sheet, order] = await Promise.all([loadResultSheet(id), prisma.testOrder.findUniqueOrThrow({ where: { id }, include: orderInclude })]);
    return NextResponse.json({ sheet, order: serializeOrder(order) });
  } catch (error) {
    return orderErrorResponse(error);
  }
}
