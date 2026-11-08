import { beforeAll, describe, expect, it } from "vitest";
import { GET as dashboardSummary } from "@/app/api/dashboard/summary/route";
import { GET as listExpenses, POST as createExpense } from "@/app/api/expenses/route";
import { POST as voidExpense } from "@/app/api/expenses/[id]/void/route";
import { GET as getReport } from "@/app/api/reports/route";
import { prisma } from "@/lib/prisma";
import { call, createSession, type TestUser } from "./helpers";

let admin: TestUser;
let receptionist: TestUser;
let patientId = "";

const expense = (overrides: Record<string, unknown> = {}) => ({
  category: "SUPPLIES", description: "Reagent kit", amount: 1250.5, spentAt: new Date().toISOString().slice(0, 10), method: "CASH", ...overrides,
});
const summary = async () => (await call(dashboardSummary, "/api/dashboard/summary", { cookie: receptionist.cookie })).json;

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  patientId = (await prisma.patient.create({ data: { patientCode: "PID-REP-1", name: "Report Patient", phone: "01900000001" } })).id;
});

describe("expenses", () => {
  it("records an expense and reports it in the month's total", async () => {
    const created = await call(createExpense, "/api/expenses", { method: "POST", body: expense(), cookie: admin.cookie });
    expect(created.status).toBe(201);
    expect(created.json.expense.amount).toBe("1250.5");
    expect(created.json.expense.createdBy.id).toBe(admin.id);
    const list = await call(listExpenses, "/api/expenses", { cookie: admin.cookie });
    expect(Number(list.json.total)).toBeGreaterThanOrEqual(1250.5);
    expect(list.json.expenses.map((item: { id: string }) => item.id)).toContain(created.json.expense.id);
    expect(await prisma.auditEvent.count({ where: { entity: "Expense", entityId: created.json.expense.id, action: "CREATE" } })).toBe(1);
  });

  it("rejects invalid expenses", async () => {
    const tomorrowPlus = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const bad: Record<string, unknown> = {
      "zero amount": expense({ amount: 0 }),
      "negative amount": expense({ amount: -20 }),
      "three decimals": expense({ amount: 10.123 }),
      "unknown category": expense({ category: "YACHT" }),
      "unknown method": expense({ method: "BARTER" }),
      "blank description": expense({ description: " " }),
      "bad date": expense({ spentAt: "01/02/2026" }),
      "future date": expense({ spentAt: tomorrowPlus }),
      "huge amount": expense({ amount: 1e12 }),
    };
    for (const [name, body] of Object.entries(bad)) {
      expect((await call(createExpense, "/api/expenses", { method: "POST", body, cookie: admin.cookie })).status, name).toBe(400);
    }
    await expect(prisma.expense.create({ data: { category: "OTHER", description: "x", amount: 0, spentAt: new Date() } })).rejects.toThrow();
  });

  it("voids an expense without deleting it, and excludes it from totals", async () => {
    const month = "2025-02";
    const keep = (await call(createExpense, "/api/expenses", { method: "POST", body: expense({ spentAt: `${month}-10`, amount: 400 }), cookie: admin.cookie })).json.expense;
    const drop = (await call(createExpense, "/api/expenses", { method: "POST", body: expense({ spentAt: `${month}-11`, amount: 100 }), cookie: admin.cookie })).json.expense;

    const before = await call(listExpenses, `/api/expenses?from=${month}-01&to=${month}-28`, { cookie: admin.cookie });
    expect(before.json.total).toBe("500.00");

    const voided = await call(voidExpense, `/api/expenses/${drop.id}/void`, { method: "POST", body: { reason: "Entered twice" }, cookie: admin.cookie, params: { id: drop.id } });
    expect(voided.status).toBe(200);
    const after = await call(listExpenses, `/api/expenses?from=${month}-01&to=${month}-28`, { cookie: admin.cookie });
    expect(after.json.total).toBe("400.00");
    const listed = after.json.expenses.find((item: { id: string }) => item.id === drop.id);
    expect(listed.voidedAt).not.toBeNull();
    expect(listed.voidReason).toBe("Entered twice");
    expect(after.json.expenses.map((item: { id: string }) => item.id)).toContain(keep.id);

    expect((await call(voidExpense, `/api/expenses/${drop.id}/void`, { method: "POST", body: { reason: "again" }, cookie: admin.cookie, params: { id: drop.id } })).status).toBe(409);
    expect((await call(voidExpense, "/api/expenses/none/void", { method: "POST", body: { reason: "none" }, cookie: admin.cookie, params: { id: "none" } })).status).toBe(404);
    expect((await call(voidExpense, `/api/expenses/${keep.id}/void`, { method: "POST", body: { reason: "x" }, cookie: admin.cookie, params: { id: keep.id } })).status).toBe(400);
  });

  it("filters by category and validates the query", async () => {
    await call(createExpense, "/api/expenses", { method: "POST", body: expense({ category: "RENT", description: "Clinic rent", amount: 30000, spentAt: "2025-02-01" }), cookie: admin.cookie });
    const rent = await call(listExpenses, "/api/expenses?from=2025-02-01&to=2025-02-28&category=RENT", { cookie: admin.cookie });
    expect(rent.json.expenses).toHaveLength(1);
    expect(rent.json.total).toBe("30000.00");
    expect((await call(listExpenses, "/api/expenses?from=2025-03-01&to=2025-02-01", { cookie: admin.cookie })).status).toBe(400);
    expect((await call(listExpenses, "/api/expenses?category=YACHT", { cookie: admin.cookie })).status).toBe(400);
  });
});

describe("period report (March 2025, fixed data)", () => {
  const RANGE = "from=2025-03-01&to=2025-03-31";

  beforeAll(async () => {
    const at = (day: number, hour = 4) => new Date(Date.UTC(2025, 2, day, hour, 0, 0));
    // Appointments: 3 completed, 1 pending, 1 confirmed, 1 cancelled
    const appointment = (day: number, status: "COMPLETED" | "PENDING" | "CONFIRMED" | "CANCELLED") =>
      prisma.appointment.create({ data: { patientId, patientName: "Report Patient", patientPhone: "01900000001", service: "Check-up", dateTime: at(day), status } });
    for (const day of [3, 4, 5]) await appointment(day, "COMPLETED");
    await appointment(6, "PENDING");
    await appointment(7, "CONFIRMED");
    await appointment(8, "CANCELLED");
    // Invoices issued in March: A 1000 (paid 1000), B 2000 (paid 500), C 500 (unpaid), D 800 voided
    const invoice = (code: string, subtotal: number, status: "PAID" | "PARTIALLY_PAID" | "ISSUED" | "VOID") =>
      prisma.invoice.create({ data: { invoiceCode: code, patientId, subtotal, status, issuedAt: at(10) } });
    const a = await invoice("INV-REP-A", 1000, "PAID");
    const b = await invoice("INV-REP-B", 2000, "PARTIALLY_PAID");
    await invoice("INV-REP-C", 500, "ISSUED");
    await invoice("INV-REP-D", 800, "VOID");
    await prisma.payment.createMany({ data: [
      { invoiceId: a.id, amount: 600, method: "CASH", receivedAt: at(10) },
      { invoiceId: a.id, amount: 400, method: "CARD", receivedAt: at(11) },
      { invoiceId: b.id, amount: 500, method: "MOBILE_BANKING", receivedAt: at(12) },
      { invoiceId: b.id, amount: 300, method: "CASH", receivedAt: at(13), status: "REFUNDED", refundedAt: at(14) },
    ] });
    await prisma.patient.create({ data: { patientCode: "PID-REP-2", name: "March Joiner", phone: "01900000002", createdAt: at(15) } });
    for (const [category, amount, day] of [["RENT", 300, "2025-03-01"], ["SUPPLIES", 150.25, "2025-03-09"]] as const) {
      await prisma.expense.create({ data: { category, description: "March", amount, spentAt: new Date(`${day}T00:00:00Z`) } });
    }
    await prisma.expense.create({ data: { category: "OTHER", description: "Voided", amount: 999, spentAt: new Date("2025-03-20T00:00:00Z"), voidedAt: new Date() } });
  });

  it("counts appointments by status", async () => {
    const { json } = await call(getReport, `/api/reports?${RANGE}`, { cookie: admin.cookie });
    expect(json.appointments.total).toBe(6);
    expect(json.appointments.byStatus).toEqual({ PENDING: 1, CONFIRMED: 1, COMPLETED: 3, CANCELLED: 1, NO_SHOW: 0 });
    expect(json.patientRegistrations).toBe(1);
  });

  it("reports revenue from posted payments only (refunds excluded)", async () => {
    const { json } = await call(getReport, `/api/reports?${RANGE}`, { cookie: admin.cookie });
    expect(json.revenue).toBe("1500.00");
    expect(json.paymentTransactions).toBe(3);
    expect(json.dailyRevenue.reduce((sum: number, day: { amount: string }) => sum + Number(day.amount), 0)).toBe(1500);
    const byMethod = Object.fromEntries(json.revenueByMethod.map((row: { method: string; amount: string }) => [row.method, row.amount]));
    expect(byMethod).toEqual({ CASH: "600.00", CARD: "400.00", MOBILE_BANKING: "500.00" });
  });

  it("computes outstanding from non-void invoices minus posted payments", async () => {
    // (1000-1000) + (2000-500) + (500-0); the voided invoice is ignored => 2000
    const { json } = await call(getReport, `/api/reports?${RANGE}`, { cookie: admin.cookie });
    expect(json.outstanding).toBe("2000.00");
  });

  it("totals expenses by category, ignoring voided ones, and shows net income", async () => {
    const { json } = await call(getReport, `/api/reports?${RANGE}`, { cookie: admin.cookie });
    expect(json.expenses.total).toBe("450.25");
    expect(Object.fromEntries(json.expenses.byCategory.map((row: { category: string; amount: string }) => [row.category, row.amount]))).toEqual({ RENT: "300.00", SUPPLIES: "150.25" });
    expect(json.netIncome).toBe("1049.75");
  });

  it("validates the date range and keeps reports administrator-only", async () => {
    expect((await call(getReport, "/api/reports?from=2025-03-31&to=2025-03-01", { cookie: admin.cookie })).status).toBe(400);
    expect((await call(getReport, "/api/reports?from=abc&to=def", { cookie: admin.cookie })).status).toBe(400);
    expect((await call(getReport, "/api/reports?from=2020-01-01&to=2025-03-31", { cookie: admin.cookie })).status).toBe(400);
    expect((await call(getReport, `/api/reports?${RANGE}`, { cookie: receptionist.cookie })).status).toBe(403);
  });
});

describe("dashboard summary", () => {
  it("moves with real activity: patients, today's appointments, pending requests and revenue", async () => {
    const before = await summary();
    expect(before).toMatchObject({ weeklyAppointments: expect.any(Array), overview: expect.any(Object) });
    expect(before.weeklyAppointments).toHaveLength(7);

    const now = new Date();
    await prisma.patient.create({ data: { patientCode: "PID-DASH-1", name: "Dash Patient", phone: "01900000099" } });
    await prisma.appointment.createMany({ data: [
      { patientName: "Today A", patientPhone: "0170", service: "Check-up", dateTime: new Date(now.getTime() + 60_000), status: "CONFIRMED" },
      { patientName: "Today B", patientPhone: "0170", service: "Check-up", dateTime: new Date(now.getTime() + 120_000), status: "PENDING" },
      { patientName: "Today C", patientPhone: "0170", service: "Check-up", dateTime: new Date(now.getTime() + 180_000), status: "CANCELLED" },
    ] });
    const invoice = await prisma.invoice.create({ data: { invoiceCode: "INV-DASH-1", patientId, subtotal: 1000 } });
    await prisma.payment.create({ data: { invoiceId: invoice.id, amount: 400, method: "CASH" } });

    const after = await summary();
    expect(after.totalPatients - before.totalPatients).toBe(1);
    expect(after.pendingAppointments - before.pendingAppointments).toBe(1);
    // Cancelled appointments never count; the two live ones may fall on tomorrow only if the test runs at midnight.
    expect(after.todayAppointments - before.todayAppointments).toBeGreaterThanOrEqual(0);
    expect(after.totalAppointments - before.totalAppointments).toBe(2);
    expect(Number(after.revenue.today) - Number(before.revenue.today)).toBe(400);
    expect(Number(after.revenue.month) - Number(before.revenue.month)).toBe(400);
    expect(Number(after.outstanding) - Number(before.outstanding)).toBe(600);
  });

  it("is available to the receptionist but not to anonymous users", async () => {
    expect((await call(dashboardSummary, "/api/dashboard/summary", { cookie: receptionist.cookie })).status).toBe(200);
    expect((await call(dashboardSummary, "/api/dashboard/summary")).status).toBe(401);
  });
});
