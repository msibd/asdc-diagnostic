import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const ACTION = "ACKNOWLEDGE_CRITICAL_RESULT";
const ackSchema = z.object({
  informedPerson: z.string().trim().min(2, "Enter who was told (name and role).").max(120),
  note: z.string().trim().max(500).nullable().optional(),
});

/** The latest "critical result communicated" record of an order, from the audit log. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "orders:read");
  if (!access.session) return apiError(access.error, access.status);
  const { id } = await params;
  const event = await prisma.auditEvent.findFirst({
    where: { action: ACTION, entity: "TestOrder", entityId: id },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true, details: true, actor: { select: { name: true } } },
  });
  const details = (event?.details ?? {}) as { informedPerson?: string; note?: string | null };
  return NextResponse.json({
    acknowledgement: event && { at: event.createdAt, by: event.actor?.name ?? "Unknown", informedPerson: details.informedPerson ?? "", note: details.note ?? null },
  });
}

/** Records that someone was told about the order's critical result(s): who, by whom, and when. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "results:enter");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, ackSchema, "Enter who was told.");
  if (!body.ok) return body.response;
  const { id } = await params;

  const order = await prisma.testOrder.findUnique({ where: { id }, select: { status: true } });
  if (!order) return apiError("Order not found.", 404);
  // Only a real critical result can be acknowledged; this keeps the log meaningful.
  const critical = await prisma.testResult.count({ where: { item: { orderId: id }, flag: { in: ["CRITICAL_LOW", "CRITICAL_HIGH"] } } });
  if (!critical) return apiError("This order has no critical result to acknowledge.", 409);

  await writeAuditEvent(request, access.session.user.id, ACTION, "TestOrder", id, {
    informedPerson: body.data.informedPerson,
    note: body.data.note ?? null,
    criticalValues: critical,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
