import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { invoiceTotalCents, paidCents, statusForPayments } from "@/modules/billing/services/invoice-math";

const refundSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "billing:refund");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = refundSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "A refund reason is required." }, { status: 400 });
  const { id } = await params;

  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(41680271)`;
    const payment = await transaction.payment.findUnique({ where: { id } });
    if (!payment) return { error: "Payment not found.", status: 404 as const };
    if (payment.status !== "POSTED") return { error: "Only posted payments can be refunded.", status: 409 as const };

    const refunded = await transaction.payment.update({
      where: { id },
      data: { status: "REFUNDED", refundedAt: new Date(), note: `${payment.note ? `${payment.note}\n` : ""}Refund: ${parsed.data.reason}` },
    });
    const invoice = await transaction.invoice.findUnique({
      where: { id: payment.invoiceId },
      include: { payments: { where: { status: "POSTED" }, select: { amount: true } } },
    });
    if (invoice) {
      // A voided invoice never has payments (void is refused once any payment exists), so this only
      // recalculates live invoices.
      await transaction.invoice.update({
        where: { id: invoice.id },
        data: { status: statusForPayments(paidCents(invoice.payments), invoiceTotalCents(invoice)) },
      });
    }
    await writeAuditEvent(request, access.session.user.id, "REFUND_PAYMENT", "Payment", id, { reason: parsed.data.reason }, transaction);
    return { payment: refunded };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ payment: { ...result.payment, amount: result.payment.amount.toString() } });
}
