import { NextResponse } from "next/server";
import { PaymentMethod } from "@/generated/prisma/client";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { invoiceTotalCents, paidCents, statusForPayments, toCents } from "@/modules/billing/services/invoice-math";

const paymentSchema = z.object({
  amount: z.number().finite().positive().max(99999999),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().trim().max(120).nullable(),
  note: z.string().trim().max(1000).nullable(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "billing:payment");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = paymentSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payment." }, { status: 400 });
  const { id } = await params;

  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(41680271)`;
    const invoice = await transaction.invoice.findUnique({
      where: { id },
      include: { payments: { where: { status: "POSTED" }, select: { amount: true } } },
    });
    if (!invoice) return { error: "Invoice not found.", status: 404 as const };
    if (invoice.status === "VOID") return { error: "Voided invoices cannot receive payments.", status: 409 as const };

    const totalCents = invoiceTotalCents(invoice);
    const alreadyPaidCents = paidCents(invoice.payments);
    const amountCents = toCents(parsed.data.amount);
    if (amountCents > totalCents - alreadyPaidCents) return { error: "Payment exceeds the invoice's outstanding balance.", status: 400 as const };

    const payment = await transaction.payment.create({
      data: { invoiceId: id, ...parsed.data, amount: amountCents / 100 },
    });
    await transaction.invoice.update({
      where: { id },
      data: { status: statusForPayments(alreadyPaidCents + amountCents, totalCents) },
    });
    await writeAuditEvent(request, access.session.user.id, "RECEIVE_PAYMENT", "Invoice", id, {
      amount: parsed.data.amount,
      method: parsed.data.method,
    }, transaction);
    return { payment };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ payment: { ...result.payment, amount: result.payment.amount.toString() } }, { status: 201 });
}
