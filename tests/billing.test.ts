import { beforeAll, describe, expect, it } from "vitest";
import { GET as dailyCollection } from "@/app/api/billing/daily-collection/route";
import { GET as listInvoices, POST as createInvoice } from "@/app/api/billing/route";
import { POST as recordPayment } from "@/app/api/billing/[id]/payments/route";
import { POST as voidInvoice } from "@/app/api/billing/[id]/void/route";
import { POST as refundPayment } from "@/app/api/billing/payments/[id]/refund/route";
import { prisma } from "@/lib/prisma";
import {
  computeInvoiceTotals,
  formatCents,
  invoiceTotalCents,
  paidCents,
  statusForPayments,
} from "@/modules/billing/services/invoice-math";
import { call, createSession, type TestUser } from "./helpers";

let admin: TestUser;
let receptionist: TestUser;
let patientId = "";
let serviceId = "";

const item = (unitPrice: number, quantity = 1, description = "Item") => ({ serviceId: null, description, quantity, unitPrice });
const invoiceBody = (overrides: Record<string, unknown> = {}) => ({
  patientId, discount: 0, tax: 0, notes: null, items: [item(1000)], ...overrides,
});
const issue = (body: unknown, cookie = admin.cookie) => call(createInvoice, "/api/billing", { method: "POST", body, cookie });
const pay = (id: string, amount: number, method = "CASH", cookie = admin.cookie) =>
  call(recordPayment, `/api/billing/${id}/payments`, { method: "POST", body: { amount, method, reference: null, note: null }, cookie, params: { id } });
const refund = (paymentId: string, cookie = admin.cookie) =>
  call(refundPayment, `/api/billing/payments/${paymentId}/refund`, { method: "POST", body: { reason: "Patient request" }, cookie, params: { id: paymentId } });
const statusOf = async (id: string) => (await prisma.invoice.findUniqueOrThrow({ where: { id } })).status;

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  patientId = (await prisma.patient.create({ data: { patientCode: "PID-BILL-1", name: "Billing Patient", phone: "01600000001" } })).id;
  serviceId = (await prisma.clinicService.create({ data: { code: "FILL", name: "Filling", standardPrice: 800 } })).id;
});

describe("invoice arithmetic (pure)", () => {
  it("sums line items in cents without floating-point drift", () => {
    const totals = computeInvoiceTotals([{ quantity: 3, unitPrice: 33.33 }, { quantity: 1, unitPrice: 0.1 }, { quantity: 1, unitPrice: 0.2 }], 0, 0);
    expect(totals.subtotalCents).toBe(10029); // 99.99 + 0.10 + 0.20
    expect(formatCents(totals.subtotalCents)).toBe("100.29");
  });

  it("applies discount and tax", () => {
    const totals = computeInvoiceTotals([{ quantity: 2, unitPrice: 500 }], 100, 45.5);
    expect(totals).toEqual({ subtotalCents: 100000, discountCents: 10000, taxCents: 4550, totalCents: 94550 });
  });

  it("derives total, paid and status from stored decimals", () => {
    expect(invoiceTotalCents({ subtotal: "1000.00", discount: "100.00", tax: "50.25" })).toBe(95025);
    expect(paidCents([{ amount: "400.10" }, { amount: "0.20" }])).toBe(40030);
    expect(statusForPayments(0, 90000)).toBe("ISSUED");
    expect(statusForPayments(40000, 90000)).toBe("PARTIALLY_PAID");
    expect(statusForPayments(90000, 90000)).toBe("PAID");
  });
});

describe("issuing invoices", () => {
  it("issues an invoice with the correct totals and a sequential number", async () => {
    const first = await issue(invoiceBody({ items: [item(500, 2, "Scaling"), item(250.5, 1, "Polish")], discount: 100, tax: 20 }));
    expect(first.status).toBe(201);
    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: first.json.invoice.id }, include: { items: true } });
    expect(stored.subtotal.toString()).toBe("1250.5");
    expect(invoiceTotalCents(stored)).toBe(117050); // 1250.50 - 100 + 20
    expect(stored.status).toBe("ISSUED");
    expect(stored.items.map((line) => line.amount.toString()).sort()).toEqual(["1000", "250.5"]);
    expect(first.json.invoice.invoiceCode).toMatch(/^INV-\d{6}$/);

    const second = await issue(invoiceBody());
    expect(Number(second.json.invoice.invoiceCode.slice(4))).toBe(Number(first.json.invoice.invoiceCode.slice(4)) + 1);
  });

  it("never gives two simultaneous invoices the same number", async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => issue(invoiceBody())));
    expect(results.every((result) => result.status === 201)).toBe(true);
    const codes = results.map((result) => result.json.invoice.invoiceCode as string);
    expect(new Set(codes).size).toBe(10);
  });

  it("lets the receptionist issue invoices and records the audit event with the invoice", async () => {
    const { status, json } = await issue(invoiceBody(), receptionist.cookie);
    expect(status).toBe(201);
    const audit = await prisma.auditEvent.findFirst({ where: { entity: "Invoice", entityId: json.invoice.id, action: "ISSUE" } });
    expect(audit?.actorId).toBe(receptionist.id);
  });

  it("links a catalogue service but refuses an inactive one", async () => {
    expect((await issue(invoiceBody({ items: [{ ...item(800), serviceId }] }))).status).toBe(201);
    await prisma.clinicService.update({ where: { id: serviceId }, data: { isActive: false } });
    const refused = await issue(invoiceBody({ items: [{ ...item(800), serviceId }] }));
    await prisma.clinicService.update({ where: { id: serviceId }, data: { isActive: true } });
    expect(refused.status).toBe(409);
  });

  it("rejects invalid invoices", async () => {
    const cases: Record<string, unknown> = {
      "no items": invoiceBody({ items: [] }),
      "negative price": invoiceBody({ items: [item(-5)] }),
      "zero quantity": invoiceBody({ items: [item(100, 0)] }),
      "fractional quantity": invoiceBody({ items: [item(100, 1.5)] }),
      "blank description": invoiceBody({ items: [item(100, 1, "  ")] }),
      "negative discount": invoiceBody({ discount: -1 }),
      "negative tax": invoiceBody({ tax: -1 }),
      "discount above total": invoiceBody({ discount: 5000 }),
      "missing patient id": { ...invoiceBody(), patientId: "" },
    };
    for (const [name, body] of Object.entries(cases)) expect((await issue(body)).status, name).toBe(400);
    expect((await issue(invoiceBody({ patientId: "no-such-patient" }))).status).toBe(404);
  });

  it("enforces the same rules in the database, below the API", async () => {
    await expect(prisma.invoice.create({ data: { invoiceCode: "INV-BAD-1", patientId, subtotal: 100, discount: 500 } })).rejects.toThrow();
    await expect(prisma.invoice.create({ data: { invoiceCode: "INV-BAD-2", patientId, subtotal: -1 } })).rejects.toThrow();
    const invoice = (await issue(invoiceBody())).json.invoice;
    await expect(prisma.payment.create({ data: { invoiceId: invoice.id, amount: 0, method: "CASH" } })).rejects.toThrow();
  });
});

describe("payments", () => {
  it("handles partial payments, due balance and full settlement", async () => {
    const invoice = (await issue(invoiceBody({ items: [item(1000)], discount: 100 }))).json.invoice; // total 900
    expect((await pay(invoice.id, 300, "CASH")).status).toBe(201);
    expect(await statusOf(invoice.id)).toBe("PARTIALLY_PAID");
    expect((await pay(invoice.id, 250.5, "MOBILE_BANKING")).status).toBe(201);
    expect(await statusOf(invoice.id)).toBe("PARTIALLY_PAID");

    const listed = (await call(listInvoices, `/api/billing?search=${invoice.invoiceCode}`, { cookie: admin.cookie })).json.invoices[0];
    expect(listed.total).toBe("900.00");
    expect(listed.payments).toHaveLength(2);

    expect((await pay(invoice.id, 349.5, "CARD")).status).toBe(201);
    expect(await statusOf(invoice.id)).toBe("PAID");
    const methods = (await prisma.payment.findMany({ where: { invoiceId: invoice.id } })).map((payment) => payment.method).sort();
    expect(methods).toEqual(["CARD", "CASH", "MOBILE_BANKING"]);
  });

  it("will not accept more than the outstanding balance", async () => {
    const invoice = (await issue(invoiceBody({ items: [item(500)] }))).json.invoice;
    await pay(invoice.id, 200);
    const over = await pay(invoice.id, 300.01);
    expect(over.status).toBe(400);
    expect(over.json.error).toMatch(/exceeds/i);
    expect((await pay(invoice.id, 300)).status).toBe(201);
    expect((await pay(invoice.id, 0.01)).status).toBe(400); // already fully paid
  });

  it("keeps the balance right when payments arrive at the same moment", async () => {
    const invoice = (await issue(invoiceBody({ items: [item(100)] }))).json.invoice;
    const results = await Promise.all(Array.from({ length: 5 }, () => pay(invoice.id, 40)));
    expect(results.filter((result) => result.status === 201)).toHaveLength(2); // only 2 x 40 fit within 100
    const paid = (await prisma.payment.findMany({ where: { invoiceId: invoice.id, status: "POSTED" } })).reduce((sum, payment) => sum + Number(payment.amount), 0);
    expect(paid).toBe(80);
    expect(await statusOf(invoice.id)).toBe("PARTIALLY_PAID");
  });

  it("rejects bad payments and payments to missing or voided invoices", async () => {
    const invoice = (await issue(invoiceBody())).json.invoice;
    for (const amount of [0, -10, Number.NaN]) {
      expect((await pay(invoice.id, amount)).status, String(amount)).toBe(400);
    }
    const badMethod = await call(recordPayment, `/api/billing/${invoice.id}/payments`, {
      method: "POST", cookie: admin.cookie, params: { id: invoice.id }, body: { amount: 10, method: "BARTER", reference: null, note: null },
    });
    expect(badMethod.status).toBe(400);
    expect((await pay("no-such-invoice", 10)).status).toBe(404);

    await call(voidInvoice, `/api/billing/${invoice.id}/void`, { method: "POST", body: { reason: "Entered by mistake" }, cookie: admin.cookie, params: { id: invoice.id } });
    expect((await pay(invoice.id, 10)).status).toBe(409);
  });

  it("lets the receptionist take a payment", async () => {
    const invoice = (await issue(invoiceBody())).json.invoice;
    expect((await pay(invoice.id, 100, "CASH", receptionist.cookie)).status).toBe(201);
  });

  it("writes the audit entry in the same transaction as the payment", async () => {
    const invoice = (await issue(invoiceBody())).json.invoice;
    const result = await pay(invoice.id, 50, "CARD");
    expect(result.status).toBe(201);
    const audit = await prisma.auditEvent.findFirst({ where: { entity: "Invoice", entityId: invoice.id, action: "RECEIVE_PAYMENT" } });
    expect(audit?.details).toMatchObject({ amount: 50, method: "CARD" });
  });
});

describe("refunds and voiding", () => {
  it("refunds a payment and recalculates the invoice status", async () => {
    const invoice = (await issue(invoiceBody({ items: [item(600)] }))).json.invoice;
    const first = (await pay(invoice.id, 200)).json.payment;
    const second = (await pay(invoice.id, 400)).json.payment;
    expect(await statusOf(invoice.id)).toBe("PAID");

    expect((await refund(second.id)).status).toBe(200);
    expect(await statusOf(invoice.id)).toBe("PARTIALLY_PAID");
    expect((await refund(first.id)).status).toBe(200);
    expect(await statusOf(invoice.id)).toBe("ISSUED");
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: first.id } })).refundedAt).not.toBeNull();
  });

  it("allows the balance to be paid again after a refund", async () => {
    const invoice = (await issue(invoiceBody({ items: [item(300)] }))).json.invoice;
    const payment = (await pay(invoice.id, 300)).json.payment;
    await refund(payment.id);
    expect((await pay(invoice.id, 300)).status).toBe(201);
    expect(await statusOf(invoice.id)).toBe("PAID");
  });

  it("refuses a second refund of the same payment", async () => {
    const invoice = (await issue(invoiceBody())).json.invoice;
    const payment = (await pay(invoice.id, 100)).json.payment;
    expect((await refund(payment.id)).status).toBe(200);
    expect((await refund(payment.id)).status).toBe(409);
    expect((await refund("no-such-payment")).status).toBe(404);
  });

  it("restricts refunds and voiding to administrators", async () => {
    const invoice = (await issue(invoiceBody())).json.invoice;
    const payment = (await pay(invoice.id, 100)).json.payment;
    expect((await refund(payment.id, receptionist.cookie)).status).toBe(403);
    const fresh = (await issue(invoiceBody())).json.invoice;
    const asReceptionist = await call(voidInvoice, `/api/billing/${fresh.id}/void`, { method: "POST", body: { reason: "mistake" }, cookie: receptionist.cookie, params: { id: fresh.id } });
    expect(asReceptionist.status).toBe(403);
  });

  it("voids an unpaid invoice with a recorded reason, but not one with payments", async () => {
    const unpaid = (await issue(invoiceBody())).json.invoice;
    const voided = await call(voidInvoice, `/api/billing/${unpaid.id}/void`, { method: "POST", body: { reason: "Duplicate invoice" }, cookie: admin.cookie, params: { id: unpaid.id } });
    expect(voided.status).toBe(200);
    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: unpaid.id } });
    expect(stored.status).toBe("VOID");
    expect(stored.notes).toContain("Duplicate invoice");
    expect((await call(voidInvoice, `/api/billing/${unpaid.id}/void`, { method: "POST", body: { reason: "again" }, cookie: admin.cookie, params: { id: unpaid.id } })).status).toBe(409);

    const paid = (await issue(invoiceBody())).json.invoice;
    await pay(paid.id, 10);
    expect((await call(voidInvoice, `/api/billing/${paid.id}/void`, { method: "POST", body: { reason: "wrong" }, cookie: admin.cookie, params: { id: paid.id } })).status).toBe(409);
    expect((await call(voidInvoice, `/api/billing/${unpaid.id}/void`, { method: "POST", body: { reason: "x" }, cookie: admin.cookie, params: { id: unpaid.id } })).status).toBe(400); // reason too short
  });
});

describe("daily collection", () => {
  it("totals today's collections by method and shows refunds separately", async () => {
    await prisma.payment.deleteMany();
    const invoice = (await issue(invoiceBody({ items: [item(2000)] }))).json.invoice;
    await pay(invoice.id, 500, "CASH");
    await pay(invoice.id, 300, "CASH");
    await pay(invoice.id, 700, "CARD");
    const toRefund = (await pay(invoice.id, 200, "MOBILE_BANKING")).json.payment;
    await refund(toRefund.id);

    const { status, json } = await call(dailyCollection, "/api/billing/daily-collection", { cookie: receptionist.cookie });
    expect(status).toBe(200);
    expect(json.total).toBe("1500.00");
    expect(json.transactionCount).toBe(3);
    expect(json.byMethod).toHaveLength(2);
    expect(json.byMethod).toEqual(expect.arrayContaining([
      { method: "CASH", amount: "800.00", count: 2 },
      { method: "CARD", amount: "700.00", count: 1 },
    ]));
    expect(json.refunded).toEqual({ amount: "200.00", count: 1 });
  });

  it("validates the date and returns zeros for a quiet day", async () => {
    expect((await call(dailyCollection, "/api/billing/daily-collection?date=yesterday", { cookie: admin.cookie })).status).toBe(400);
    const quiet = await call(dailyCollection, "/api/billing/daily-collection?date=2020-01-01", { cookie: admin.cookie });
    expect(quiet.json.total).toBe("0.00");
    expect(quiet.json.byMethod).toEqual([]);
  });
});
