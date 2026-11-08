import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { BRAND_NAME } from "@/lib/brand";
import { readWebsiteContent } from "@/modules/website/queries/website-content";
import { invoiceInputSchema as invoiceSchema } from "@/modules/billing/billing-schema";
import { computeInvoiceTotals, formatCents, invoiceTotalCents } from "@/modules/billing/services/invoice-math";


export async function GET(request: Request) {
  const access = await authorize(request.headers, "billing:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const searchParams = new URL(request.url).searchParams;
  const search = searchParams.get("search")?.trim() ?? "";
  const cursor = z.string().min(1).max(100).safeParse(searchParams.get("cursor") ?? undefined);
  if (searchParams.has("cursor") && !cursor.success) {
    return NextResponse.json({ error: "Invalid invoice cursor." }, { status: 400 });
  }
  const pageSize = 100;
  const rows = await prisma.invoice.findMany({
    where: search ? {
      OR: [
        { invoiceCode: { contains: search, mode: "insensitive" } },
        { patient: { name: { contains: search, mode: "insensitive" } } },
        { patient: { patientCode: { contains: search, mode: "insensitive" } } },
      ],
    } : undefined,
    select: {
      id: true,
      invoiceCode: true,
      status: true,
      subtotal: true,
      discount: true,
      tax: true,
      issuedAt: true,
      notes: true,
      testOrder: { select: { referredBy: true } },
      patient: { select: { id: true, patientCode: true, name: true, phone: true, dateOfBirth: true, sex: true } },
      items: { select: { id: true, description: true, quantity: true, unitPrice: true, amount: true, service: { select: { code: true, turnaroundHours: true } } } },
      payments: {
        select: { id: true, amount: true, method: true, status: true, receivedAt: true },
        orderBy: { receivedAt: "desc" },
      },
    },
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
    ...(cursor.success ? { cursor: { id: cursor.data }, skip: 1 } : {}),
    take: pageSize + 1,
  });
  const hasMore = rows.length > pageSize;
  const invoices = hasMore ? rows.slice(0, pageSize) : rows;
  // The centre's name and contact lines for the printed invoice.
  const [content, profile] = await Promise.all([
    readWebsiteContent(),
    prisma.doctorProfile.findUnique({ where: { id: "primary" }, select: { address: true, phone: true, email: true } }),
  ]);
  return NextResponse.json({
    clinic: { clinicName: content.clinicName.trim() || BRAND_NAME, subtitle: content.clinicSubtitle.trim(), address: profile?.address ?? null, phone: profile?.phone ?? null, email: profile?.email ?? null },
    invoices: invoices.map(({ testOrder, ...invoice }) => ({
    ...invoice,
    referredBy: testOrder?.referredBy ?? null,
    patient: { ...invoice.patient, dateOfBirth: invoice.patient.dateOfBirth?.toISOString().slice(0, 10) ?? null },
    subtotal: invoice.subtotal.toString(),
    discount: invoice.discount.toString(),
    tax: invoice.tax.toString(),
    total: formatCents(invoiceTotalCents(invoice)),
    payments: invoice.payments.map((payment) => ({ ...payment, amount: payment.amount.toString() })),
    items: invoice.items.map(({ service, ...item }) => ({ ...item, code: service?.code ?? null, turnaroundHours: service?.turnaroundHours ?? null, amount: item.amount.toString(), unitPrice: item.unitPrice.toString() })),
      })),
    nextCursor: hasMore ? invoices.at(-1)?.id ?? null : null,
  });
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "billing:invoice");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = invoiceSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid invoice." }, { status: 400 });
  const { subtotalCents, discountCents, taxCents, totalCents } = computeInvoiceTotals(parsed.data.items, parsed.data.discount, parsed.data.tax);
  if (totalCents < 0) return NextResponse.json({ error: "Discount cannot exceed subtotal plus tax." }, { status: 400 });
  const patient = await prisma.patient.findUnique({ where: { id: parsed.data.patientId }, select: { id: true } });
  if (!patient) return NextResponse.json({ error: "Patient not found." }, { status: 404 });
  const serviceIds = parsed.data.items.flatMap((item) => item.serviceId ? [item.serviceId] : []);
  if (serviceIds.length) {
    const activeServiceCount = await prisma.clinicService.count({
      where: { id: { in: serviceIds }, isActive: true },
    });
    if (activeServiceCount !== new Set(serviceIds).size) {
      return NextResponse.json({ error: "One or more selected services are no longer active." }, { status: 409 });
    }
  }

  const invoice = await prisma.$transaction(async (transaction) => {
    // Sequential, collision-free invoice numbers (INV-000123).
    const [sequence] = await transaction.$queryRaw<{ value: string }[]>`SELECT nextval('"invoice_code_seq"')::text AS value`;
    const created = await transaction.invoice.create({
      data: {
        invoiceCode: `INV-${sequence.value.padStart(6, "0")}`,
        patientId: patient.id,
        subtotal: subtotalCents / 100,
        discount: discountCents / 100,
        tax: taxCents / 100,
        notes: parsed.data.notes,
        items: {
          create: parsed.data.items.map((item) => ({
            ...item,
            unitPrice: Math.round(item.unitPrice * 100) / 100,
            amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
          })),
        },
      },
    });
    await writeAuditEvent(request, access.session.user.id, "ISSUE", "Invoice", created.id, { invoiceCode: created.invoiceCode }, transaction);
    return created;
  });
  return NextResponse.json({ invoice }, { status: 201 });
}
