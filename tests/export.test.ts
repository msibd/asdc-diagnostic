import { beforeAll, describe, expect, it } from "vitest";
import { GET as exportRoute } from "@/app/api/export/[dataset]/route";
import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { createSession, patientInput, type TestUser } from "./helpers";

let admin: TestUser;
let receptionist: TestUser;
let accountant: TestUser;
const run = Date.now().toString(36).toUpperCase();

const get = async (dataset: string, query: Record<string, string> = {}, user: TestUser | null = admin) => {
  const response = await exportRoute(
    new Request(`http://localhost:3000/api/export/${dataset}?${new URLSearchParams(query)}`, { headers: user ? { cookie: user.cookie } : {} }),
    { params: Promise.resolve({ dataset }) },
  );
  // Read the raw bytes: Response.text() would silently drop the byte-order mark that Excel needs.
  const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await response.arrayBuffer());
  return { status: response.status, headers: response.headers, text };
};
const table = (text: string) => parseCsv(text);

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  accountant = await createSession("accountant");
});

describe("permissions and validation", () => {
  it("applies the permission of the list, and refuses guests", async () => {
    expect((await get("patients", {}, receptionist)).status).toBe(403); // sees patients, but not the bulk export
    expect((await get("audit-log", {}, accountant)).status).toBe(403);
    expect((await get("expenses", {}, accountant)).status).toBe(200);
    expect((await get("payments", {}, accountant)).status).toBe(200);
    expect((await get("expenses", {}, null)).status).toBeGreaterThanOrEqual(401);
  });

  it("rejects bad filters and unknown exports", async () => {
    expect((await get("nothing")).status).toBe(404);
    expect((await get("expenses", { from: "2001-13-45" })).status).toBe(400);
    expect((await get("expenses", { from: "2001-05-02", to: "2001-05-01" })).status).toBe(400);
    expect((await get("expenses", { category: "BOGUS" })).status).toBe(400);
    expect((await get("orders", { status: "BOGUS" })).status).toBe(400);
  });
});

describe("patients", () => {
  const names = [`Zed Export ${run}`, `=HYPERLINK("http://evil")${run}`, `Rahim "Ovi" ${run}`, `নাজমা ${run}`];
  beforeAll(async () => {
    let index = 0;
    for (const name of names) {
      await prisma.patient.create({ data: { ...patientInput(), patientCode: `PID-E${run}${index++}`, name, address: "Secret Road 5", medicalHistory: "Diabetes", allergies: "Penicillin", dateOfBirth: new Date("1980-02-03"), isActive: index !== 4 } });
    }
  });

  it("writes only the safe columns, protects formulas, and keeps Bangla and quotes intact", async () => {
    const result = await get("patients", { search: run, sort: "name" });
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toMatch(/text\/csv/);
    expect(result.headers.get("content-disposition")).toMatch(/attachment; filename="clinic-patients-\d{4}-\d{2}-\d{2}\.csv"/);
    expect(result.text.startsWith("﻿")).toBe(true);
    const rows = table(result.text);
    expect(rows[0]).toEqual(["Patient ID", "Name", "Phone", "Status", "Registered"]);
    expect(rows).toHaveLength(5);
    const exported = rows.slice(1).map((row) => row[1]);
    expect(exported).toContain(`'=HYPERLINK("http://evil")${run}`); // a leading apostrophe stops it running as a formula
    expect(exported).toContain(`Rahim "Ovi" ${run}`);
    expect(exported).toContain(`নাজমা ${run}`);
    expect(result.text).not.toMatch(/Secret Road|Diabetes|Penicillin|1980/);
  });

  it("follows the search, status and sort that are on screen", async () => {
    const byName = table((await get("patients", { search: run, sort: "name" })).text).slice(1).map((row) => row[1]);
    expect(byName[0]).toBe(`'=HYPERLINK("http://evil")${run}`);
    const inactive = table((await get("patients", { search: run, status: "INACTIVE" })).text).slice(1);
    expect(inactive).toHaveLength(1);
    expect(inactive[0][3]).toBe("Inactive");
    expect(table((await get("patients", { search: `no-such-${run}` })).text)).toHaveLength(1); // header only
  });
});

describe("payments", () => {
  beforeAll(async () => {
    const patient = await prisma.patient.create({ data: { ...patientInput({ name: `Pay Person ${run}` }), patientCode: `PID-P${run}` } });
    const invoice = await prisma.invoice.create({ data: { invoiceCode: `INV-X${run}`, patientId: patient.id, subtotal: 1000 } });
    const day = (iso: string) => new Date(iso);
    await prisma.payment.createMany({ data: [
      { invoiceId: invoice.id, amount: 100.5, method: "CASH", status: "POSTED", receivedAt: day("2001-03-05T04:00:00Z") },
      { invoiceId: invoice.id, amount: 200, method: "CARD", status: "POSTED", receivedAt: day("2001-03-05T08:00:00Z") },
      { invoiceId: invoice.id, amount: 50, method: "CASH", status: "REFUNDED", receivedAt: day("2001-03-05T09:00:00Z") },
      { invoiceId: invoice.id, amount: 999, method: "CASH", status: "POSTED", receivedAt: day("2001-03-09T09:00:00Z") },
    ] });
  });

  it("exports only posted payments inside the dates, with the patient ID and never the name", async () => {
    const result = await get("payments", { from: "2001-03-05", to: "2001-03-05" });
    const rows = table(result.text);
    expect(rows).toHaveLength(3);
    expect(rows.slice(1).map((row) => Number(row[5])).sort((a, b) => a - b)).toEqual([100.5, 200]);
    expect(rows[1][2]).toBe(`PID-P${run}`);
    expect(result.text).not.toContain("Pay Person");
    expect(result.headers.get("content-disposition")).toContain("clinic-payments-2001-03-05_to_2001-03-05.csv");
  });

  it("prints a report with the title, dates, rows and the correct total", async () => {
    const result = await get("payments", { from: "2001-03-05", to: "2001-03-05", format: "print" });
    expect(result.status).toBe(200);
    expect(result.headers.get("content-type")).toMatch(/text\/html/);
    expect(result.text).toContain("Payments received");
    expect(result.text).toContain("2001-03-05 to 2001-03-05");
    expect(result.text).toContain("2 rows");
    expect(result.text).toContain('<td class="num">300.50</td>');
    expect(result.text).toContain("Printed");
    expect(result.text).not.toContain("Pay Person");
  });
});

describe("expenses", () => {
  beforeAll(async () => {
    await prisma.expense.createMany({ data: [
      { category: "RENT", description: `Rent ${run}`, amount: 1000.25, spentAt: new Date("2001-04-01") },
      { category: "SUPPLIES", description: `<script>alert(1)</script> ${run}`, amount: 20, spentAt: new Date("2001-04-02") },
      { category: "SUPPLIES", description: `Voided ${run}`, amount: 5000, spentAt: new Date("2001-04-02"), voidedAt: new Date() },
      { category: "SUPPLIES", description: `Outside ${run}`, amount: 7, spentAt: new Date("2001-05-02") },
    ] });
  });

  it("skips voided expenses, honours date and category, and totals what it lists", async () => {
    const all = table((await get("expenses", { from: "2001-04-01", to: "2001-04-30" })).text);
    expect(all.slice(1).map((row) => row[2]).sort()).toEqual([`<script>alert(1)</script> ${run}`, `Rent ${run}`].sort());
    const supplies = table((await get("expenses", { from: "2001-04-01", to: "2001-04-30", category: "SUPPLIES" })).text);
    expect(supplies).toHaveLength(2);
    const printed = (await get("expenses", { from: "2001-04-01", to: "2001-04-30", format: "print" })).text;
    expect(printed).toContain('<td class="num">1020.25</td>');
  });

  it("escapes markup in the printable report", async () => {
    const printed = (await get("expenses", { from: "2001-04-01", to: "2001-04-30", format: "print" })).text;
    expect(printed).not.toContain("<script>alert(1)</script>");
    expect(printed).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});

describe("other lists", () => {
  it("exports orders with the patient ID, filtered by status", async () => {
    const patient = await prisma.patient.create({ data: { ...patientInput(), patientCode: `PID-O${run}` } });
    await prisma.testOrder.create({ data: { orderCode: `ORD-X${run}`, patientId: patient.id, orderedAt: new Date("2001-06-02T05:00:00Z"), status: "ORDERED" } });
    await prisma.testOrder.create({ data: { orderCode: `ORD-Y${run}`, patientId: patient.id, orderedAt: new Date("2001-06-02T06:00:00Z"), status: "CANCELLED" } });
    const rows = table((await get("orders", { from: "2001-06-02", to: "2001-06-02", status: "CANCELLED" }, receptionist)).text);
    expect(rows).toHaveLength(2);
    expect(rows[1].slice(0, 5)).toEqual([`ORD-Y${run}`, "2001-06-02 12:00 PM", `PID-O${run}`, "CANCELLED", "ROUTINE"]);
    // "Open" is the screen's group for unfinished orders: it leaves out the cancelled one.
    const open = table((await get("orders", { from: "2001-06-02", to: "2001-06-02", status: "OPEN" }, receptionist)).text);
    expect(open.slice(1).map((row) => row[0])).toEqual([`ORD-X${run}`]);
  });

  it("exports cash closings with signed numbers kept as numbers", async () => {
    await prisma.cashClosing.create({ data: { businessDate: new Date("2001-07-01"), openingCash: 100, cashReceived: 500, cashRefunded: 0, cashExpenses: 50, expectedCash: 550, countedCash: 540, difference: -10 } });
    const rows = table((await get("cash-closings", { from: "2001-07-01", to: "2001-07-01" }, accountant)).text);
    expect(rows[1]).toEqual(["2001-07-01", "100", "500", "0", "50", "550", "540", "-10"]);
  });

  it("exports the activity log without details or addresses, and records each export", async () => {
    const rows = table((await get("audit-log", {})).text);
    expect(rows[0]).toEqual(["Time", "Staff", "Action", "Record type"]);
    const event = await prisma.auditEvent.findFirst({ where: { action: "EXPORT", entity: "audit-log" }, orderBy: { createdAt: "desc" } });
    expect(event?.details).toMatchObject({ format: "csv" });
  });
});

describe("large lists", () => {
  it("writes every row of a list longer than one chunk, in order, without repeats", async () => {
    await prisma.expense.createMany({ data: Array.from({ length: 1_050 }, (_, index) => ({ category: "OTHER" as const, description: `Bulk ${run} ${String(index).padStart(4, "0")}`, amount: 1, spentAt: new Date("2001-08-01") })) });
    const rows = table((await get("expenses", { from: "2001-08-01", to: "2001-08-01" })).text).slice(1);
    expect(rows).toHaveLength(1_050);
    expect(new Set(rows.map((row) => row[2])).size).toBe(1_050);
  });
});
