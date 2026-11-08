import type { Prisma, TestOrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { computeInvoiceTotals, formatCents, invoiceTotalCents, paidCents } from "@/modules/billing/services/invoice-math";
import type { CreateOrderInput } from "@/modules/orders/schemas/order-schema";
import { canCancelOrder, canChangeSamples, deriveOrderStatus, groupBySample, planOrder, type CatalogRow } from "@/modules/orders/services/order-rules";

/** Raised for problems the person can fix; the route turns it into a normal error response. */
export class OrderError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 400) {
    super(message);
  }
}

/** Writes an audit row inside the same transaction as the change (bound to the request by the route). */
export type AuditRecorder = (db: Prisma.TransactionClient, action: string, entity: string, entityId: string, details?: { [key: string]: string | number | boolean | null }) => Promise<void>;

export const orderInclude = {
  patient: { select: { id: true, patientCode: true, name: true, phone: true, sex: true, dateOfBirth: true } },
  items: {
    orderBy: { testName: "asc" as const },
    select: { id: true, testId: true, testCode: true, testName: true, sampleType: true, sampleId: true, panelId: true, resultStatus: true, panel: { select: { name: true } } },
  },
  samples: { orderBy: { createdAt: "asc" as const } },
  invoice: { select: { id: true, invoiceCode: true, status: true, subtotal: true, discount: true, tax: true, payments: { select: { amount: true, status: true } } } },
} satisfies Prisma.TestOrderInclude;

type OrderRow = Prisma.TestOrderGetPayload<{ include: typeof orderInclude }>;

/** JSON-safe order: dates as ISO text, money as text, with the invoice balance worked out. */
export function serializeOrder(order: OrderRow) {
  const { invoice, patient, ...rest } = order;
  const posted = invoice?.payments.filter((payment) => payment.status === "POSTED") ?? [];
  const total = invoice ? invoiceTotalCents(invoice) : 0;
  const paid = paidCents(posted);
  return {
    ...rest,
    patient: { ...patient, dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString().slice(0, 10) : null },
    invoice: invoice ? {
      id: invoice.id,
      invoiceCode: invoice.invoiceCode,
      status: invoice.status,
      subtotal: invoice.subtotal.toString(),
      discount: invoice.discount.toString(),
      total: formatCents(total),
      paid: formatCents(paid),
      due: formatCents(Math.max(total - paid, 0)),
    } : null,
  };
}

// ---------------------------------------------------------------- placing an order

export async function createOrder(input: CreateOrderInput, record: AuditRecorder) {
  const ids = [...new Set(input.serviceIds)];
  if (ids.length !== input.serviceIds.length) throw new OrderError("An item is selected twice.");

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUnique({ where: { id: input.patientId }, select: { id: true, isActive: true } });
    if (!patient) throw new OrderError("Patient not found.", 404);
    if (!patient.isActive) throw new OrderError("This patient is inactive. Reactivate the patient first.", 409);

    const services = await tx.clinicService.findMany({
      where: { id: { in: ids } },
      include: { panelMembers: { include: { test: { select: { id: true, code: true, name: true, sampleType: true, isActive: true } } } } },
    });
    if (services.length !== ids.length) throw new OrderError("One or more selected items no longer exist.", 409);
    const byId = new Map(services.map((service) => [service.id, service]));
    const picked: CatalogRow[] = ids.map((id) => {
      const service = byId.get(id)!;
      return {
        id: service.id, code: service.code, name: service.name, kind: service.kind, isActive: service.isActive,
        standardPrice: Number(service.standardPrice), sampleType: service.sampleType,
        members: service.panelMembers.map((member) => member.test),
      };
    });

    const planned = planOrder(picked);
    if ("error" in planned) throw new OrderError(planned.error, 409);
    const { plan } = planned;

    const { subtotalCents, discountCents, totalCents } = computeInvoiceTotals(plan.invoiceItems, input.discount, 0);
    if (totalCents < 0) throw new OrderError("The discount cannot be more than the total.");

    const [invoiceSeq] = await tx.$queryRaw<{ value: string }[]>`SELECT nextval('"invoice_code_seq"')::text AS value`;
    const [orderSeq] = await tx.$queryRaw<{ value: string }[]>`SELECT nextval('"test_order_code_seq"')::text AS value`;

    const invoice = await tx.invoice.create({
      data: {
        invoiceCode: `INV-${invoiceSeq.value.padStart(6, "0")}`,
        patientId: patient.id,
        subtotal: subtotalCents / 100,
        discount: discountCents / 100,
        tax: 0,
        notes: null,
        items: {
          create: plan.invoiceItems.map((item) => ({
            serviceId: item.serviceId,
            description: item.description,
            quantity: item.quantity,
            unitPrice: Math.round(item.unitPrice * 100) / 100,
            amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
          })),
        },
      },
    });

    const order = await tx.testOrder.create({
      data: {
        orderCode: `ORD-${orderSeq.value.padStart(6, "0")}`,
        patientId: patient.id,
        invoiceId: invoice.id,
        priority: input.priority,
        referredBy: input.referredBy,
        clinicalNotes: input.clinicalNotes,
      },
    });

    // One sample per sample type; tests that need no sample (e.g. an ECG) get none.
    const { groups, withoutSample } = groupBySample(plan.tests);
    const sampleIdByType = new Map<string, string>();
    for (const sampleType of groups.keys()) {
      const sample = await tx.sample.create({ data: { orderId: order.id, sampleType, sampleCode: await nextSampleCode(tx) } });
      sampleIdByType.set(sampleType, sample.id);
    }
    await tx.testOrderItem.createMany({
      data: [...groups.values(), withoutSample].flat().map((test) => ({
        orderId: order.id, testId: test.testId, panelId: test.panelId, testCode: test.code, testName: test.name,
        sampleType: test.sampleType, sampleId: test.sampleType ? sampleIdByType.get(test.sampleType) ?? null : null,
      })),
    });
    // With nothing to collect the order is ready for the lab straight away.
    await syncOrderStatus(tx, order.id);

    await record(tx, "CREATE", "TestOrder", order.id, { orderCode: order.orderCode, invoiceCode: invoice.invoiceCode, items: plan.tests.length, total: totalCents / 100 });
    return order.id;
  });
}

async function nextSampleCode(tx: Prisma.TransactionClient) {
  const [row] = await tx.$queryRaw<{ value: string }[]>`SELECT nextval('"sample_code_seq"')::text AS value`;
  return `SMP-${row.value.padStart(6, "0")}`;
}

/** Recomputes the order status from its samples and results, and saves it if it changed. */
export async function syncOrderStatus(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.testOrder.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true, samples: { select: { status: true } }, items: { select: { resultStatus: true } } },
  });
  const next = deriveOrderStatus(order.status, order.samples, order.items);
  if (next !== order.status) await tx.testOrder.update({ where: { id: orderId }, data: { status: next } });
}

// ---------------------------------------------------------------- sample handling

export type SampleAction = { action: "collect" } | { action: "receive" } | { action: "reject"; reason: string };

/** Collects, receives or rejects one sample. A rejected sample is replaced by a new pending one. */
export async function changeSample(sampleId: string, change: SampleAction, actorName: string, record: AuditRecorder) {
  return prisma.$transaction(async (tx) => {
    const sample = await tx.sample.findUnique({ where: { id: sampleId }, include: { order: { select: { id: true, orderCode: true, status: true } } } });
    if (!sample) throw new OrderError("Sample not found.", 404);
    if (!canChangeSamples(sample.order.status)) {
      throw new OrderError(sample.order.status === "CANCELLED" ? "This order was cancelled." : "Results are already being entered for this order, so its samples can no longer be changed.", 409);
    }
    const now = new Date();

    if (change.action === "collect") {
      const done = await tx.sample.updateMany({ where: { id: sampleId, status: "PENDING" }, data: { status: "COLLECTED", collectedAt: now, collectedBy: actorName } });
      if (!done.count) throw new OrderError(sample.status === "REJECTED" ? "This sample was rejected. Collect its replacement instead." : "This sample has already been collected.", 409);
    } else if (change.action === "receive") {
      if (sample.status === "PENDING") throw new OrderError("This sample has not been collected yet.", 409);
      const done = await tx.sample.updateMany({ where: { id: sampleId, status: "COLLECTED" }, data: { status: "RECEIVED", receivedAt: now, receivedBy: actorName } });
      if (!done.count) throw new OrderError(sample.status === "REJECTED" ? "This sample was rejected." : "This sample has already been received.", 409);
    } else {
      const done = await tx.sample.updateMany({
        where: { id: sampleId, status: { in: ["COLLECTED", "RECEIVED"] } },
        data: { status: "REJECTED", rejectedAt: now, rejectedBy: actorName, rejectReason: change.reason },
      });
      if (!done.count) throw new OrderError(sample.status === "PENDING" ? "Only a collected sample can be rejected." : "This sample was already rejected.", 409);
      // The tests move to a fresh pending sample so the order asks for a recollection.
      const replacement = await tx.sample.create({ data: { orderId: sample.orderId, sampleType: sample.sampleType, sampleCode: await nextSampleCode(tx), replacesId: sample.id } });
      await tx.testOrderItem.updateMany({ where: { sampleId: sample.id }, data: { sampleId: replacement.id } });
    }

    await syncOrderStatus(tx, sample.orderId);
    await record(tx, change.action.toUpperCase(), "Sample", sample.id, {
      sampleCode: sample.sampleCode, orderCode: sample.order.orderCode, ...(change.action === "reject" ? { reason: change.reason } : {}),
    });
    return { orderId: sample.orderId, sampleCode: sample.sampleCode };
  });
}

/** Marks a sample received from its barcode text (what a scanner types). */
export async function receiveByCode(code: string, actorName: string, record: AuditRecorder) {
  const sample = await prisma.sample.findUnique({ where: { sampleCode: code.trim().toUpperCase() }, select: { id: true } });
  if (!sample) throw new OrderError(`No sample has the code ${code.trim().toUpperCase()}.`, 404);
  return changeSample(sample.id, { action: "receive" }, actorName, record);
}

// ---------------------------------------------------------------- cancelling

/**
 * Cancels an order before result entry starts. The invoice is voided when nothing was paid; if
 * money was paid it must be refunded in Billing first, and a fully refunded invoice stays on record.
 */
export async function cancelOrder(orderId: string, reason: string, record: AuditRecorder) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(41680271)`; // the same lock invoice voiding takes
    const order = await tx.testOrder.findUnique({ where: { id: orderId }, include: { invoice: { include: { payments: true } } } });
    if (!order) throw new OrderError("Order not found.", 404);
    if (order.status === "CANCELLED") throw new OrderError("This order is already cancelled.", 409);
    if (!canCancelOrder(order.status)) throw new OrderError("Results are already being entered, so this order can no longer be cancelled.", 409);

    const posted = order.invoice?.payments.filter((payment) => payment.status === "POSTED") ?? [];
    if (posted.length) throw new OrderError("This order has payments. Refund them in Billing first, then cancel the order.", 409);

    if (order.invoice && order.invoice.status !== "VOID" && order.invoice.payments.length === 0) {
      await tx.invoice.update({
        where: { id: order.invoice.id },
        data: { status: "VOID", notes: `${order.invoice.notes ? `${order.invoice.notes}\n` : ""}Voided: order ${order.orderCode} cancelled (${reason})` },
      });
    }
    await tx.testOrder.update({ where: { id: orderId }, data: { status: "CANCELLED", cancelReason: reason, cancelledAt: new Date() } });
    await record(tx, "CANCEL", "TestOrder", orderId, { orderCode: order.orderCode, reason });
    return order.orderCode;
  });
}

// ---------------------------------------------------------------- listing

export const ORDER_PAGE_SIZE = 50;
export const ORDER_STATUSES: readonly TestOrderStatus[] = ["ORDERED", "SAMPLE_COLLECTED", "RECEIVED", "IN_PROCESS", "RESULT_ENTERED", "VERIFIED", "DELIVERED", "CANCELLED"];

export async function listOrders({ search, status, cursor }: { search: string; status: string; cursor?: string }) {
  const where: Prisma.TestOrderWhereInput = {
    ...(status === "OPEN" ? { status: { notIn: ["CANCELLED", "DELIVERED"] } } : ORDER_STATUSES.includes(status as TestOrderStatus) ? { status: status as TestOrderStatus } : {}),
    ...(search ? {
      OR: [
        { orderCode: { contains: search, mode: "insensitive" } },
        { patient: { name: { contains: search, mode: "insensitive" } } },
        { patient: { phone: { contains: search } } },
        { patient: { patientCode: { contains: search, mode: "insensitive" } } },
        { samples: { some: { sampleCode: { contains: search, mode: "insensitive" } } } },
      ],
    } : {}),
  };
  const rows = await prisma.testOrder.findMany({
    where,
    include: orderInclude,
    orderBy: [{ orderedAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: ORDER_PAGE_SIZE + 1,
  });
  const hasMore = rows.length > ORDER_PAGE_SIZE;
  const page = hasMore ? rows.slice(0, ORDER_PAGE_SIZE) : rows;
  return { orders: page.map(serializeOrder), nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
}

