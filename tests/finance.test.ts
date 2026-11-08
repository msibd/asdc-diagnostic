import { beforeAll, describe, expect, it } from "vitest";
import { POST as createInvoice } from "@/app/api/billing/route";
import { POST as recordPayment } from "@/app/api/billing/[id]/payments/route";
import { POST as refundPayment } from "@/app/api/billing/payments/[id]/refund/route";
import { POST as createExpense } from "@/app/api/expenses/route";
import { GET as closingList, POST as closeDay } from "@/app/api/finance/closings/route";
import { GET as dailySummary } from "@/app/api/finance/daily/route";
import { prisma } from "@/lib/prisma";
import { addClinicDays, getClinicDateKey } from "@/lib/clinic-date";
import { call, createSession, type TestUser } from "./helpers";

let admin: TestUser;
let receptionist: TestUser;
let patientId = "";
const today = getClinicDateKey(new Date());

async function pay(amount: number, method: string) {
  const invoice = await call(createInvoice, "/api/billing", {
    method: "POST", cookie: admin.cookie,
    body: { patientId, discount: 0, tax: 0, notes: null, items: [{ serviceId: null, description: "Treatment", quantity: 1, unitPrice: amount }] },
  });
  expect(invoice.status).toBe(201);
  const id = invoice.json.invoice.id as string;
  const payment = await call(recordPayment, `/api/billing/${id}/payments`, { method: "POST", cookie: admin.cookie, params: { id }, body: { amount, method, reference: null, note: null } });
  expect(payment.status).toBe(201);
  return payment.json.payment.id as string;
}
const daily = (date = today, cookie = admin.cookie) => call(dailySummary, `/api/finance/daily?date=${date}`, { cookie });
const close = (body: Record<string, unknown>, cookie = admin.cookie) => call(closeDay, "/api/finance/closings", { method: "POST", cookie, body });

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  patientId = (await prisma.patient.create({ data: { patientCode: "PID-FIN-1", name: "Finance Patient", phone: "01600009001" } })).id;
});

describe("daily summary and cash closing", () => {
  it("is admin-only", async () => {
    expect((await call(dailySummary, "/api/finance/daily")).status).toBe(401);
    expect((await daily(today, receptionist.cookie)).status).toBe(403);
    expect((await close({ businessDate: today, countedCash: 0 }, receptionist.cookie)).status).toBe(403);
    expect((await daily(addClinicDays(today, 3))).status).toBe(400);
  });

  it("works out expected cash from real payments, refunds and expenses", async () => {
    const yesterday = addClinicDays(today, -1);
    // Close yesterday exactly as expected, so today opens with that cash.
    const before = await daily(yesterday);
    expect((await close({ businessDate: yesterday, countedCash: Number(before.json.cash.expected) })).status).toBe(201);
    const start = (await daily()).json;

    await pay(1000, "CASH");
    const refundable = await pay(300, "CASH");
    await pay(500, "CARD");
    expect((await call(refundPayment, `/api/billing/payments/${refundable}/refund`, { method: "POST", cookie: admin.cookie, params: { id: refundable }, body: { reason: "Patient request" } })).status).toBe(200);
    expect((await call(createExpense, "/api/expenses", { method: "POST", cookie: admin.cookie, body: { category: "SUPPLIES", description: "Gloves", amount: 200, spentAt: today, method: "CASH" } })).status).toBe(201);
    expect((await call(createExpense, "/api/expenses", { method: "POST", cookie: admin.cookie, body: { category: "UTILITIES", description: "Bill", amount: 150, spentAt: today, method: "MOBILE_BANKING" } })).status).toBe(201);

    const figures = await daily();
    expect(figures.status).toBe(200);
    // Other test files also post payments today, so compare what changed rather than absolute totals.
    const change = (after: string, was: string) => Math.round((Number(after) - Number(was)) * 100) / 100;
    expect(change(figures.json.totals.received, start.totals.received)).toBe(1800);
    expect(change(figures.json.totals.refunded, start.totals.refunded)).toBe(300);
    expect(change(figures.json.totals.income, start.totals.income)).toBe(1500);
    expect(change(figures.json.totals.expenses, start.totals.expenses)).toBe(350);
    expect(change(figures.json.totals.net, start.totals.net)).toBe(1150);
    expect(change(figures.json.cash.received, start.cash.received)).toBe(1300);
    expect(change(figures.json.cash.refunded, start.cash.refunded)).toBe(300);
    expect(change(figures.json.cash.expenses, start.cash.expenses)).toBe(200);
    expect(change(figures.json.cash.expected, start.cash.expected)).toBe(800);
    // Opening cash is what yesterday's count said, and the drawer arithmetic adds up.
    expect(figures.json.cash.opening).toBe(Number(before.json.cash.expected).toFixed(2));
    expect(Number(figures.json.cash.expected)).toBeCloseTo(
      Number(figures.json.cash.opening) + Number(figures.json.cash.received) - Number(figures.json.cash.refunded) - Number(figures.json.cash.expenses), 2);
    expect(figures.json.closing).toBeNull();
  });

  it("requires a note when the count differs, then locks the day", async () => {
    const expected = Number((await daily()).json.cash.expected);
    expect((await close({ businessDate: today, countedCash: expected - 10 })).status).toBe(400);
    expect((await close({ businessDate: today, countedCash: -5 })).status).toBe(400);
    expect((await close({ businessDate: addClinicDays(today, 1), countedCash: 0 })).status).toBe(400);

    const closed = await close({ businessDate: today, countedCash: expected - 10, note: "Ten taka short, change given" });
    expect(closed.status).toBe(201);
    expect(Number(closed.json.closing.difference)).toBe(-10);
    expect((await close({ businessDate: today, countedCash: expected })).status).toBe(409);

    const figures = await daily();
    expect(Number(figures.json.closing.countedCash)).toBe(expected - 10);
    expect(Number(figures.json.closing.expectedCash)).toBe(expected);
    expect(figures.json.closing.note).toMatch(/short/);

    const stored = await prisma.cashClosing.findUniqueOrThrow({ where: { businessDate: new Date(`${today}T00:00:00.000Z`) } });
    expect(Number(stored.countedCash)).toBe(expected - 10);
    const list = await call(closingList, "/api/finance/closings", { cookie: admin.cookie });
    expect(list.json.closings[0].businessDate).toBe(today);
  });
});
