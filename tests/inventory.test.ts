import { beforeAll, describe, expect, it } from "vitest";
import { GET as listItems, POST as createItem } from "@/app/api/inventory/items/route";
import { PATCH as updateItem } from "@/app/api/inventory/items/[id]/route";
import { GET as listMovements, POST as moveStock } from "@/app/api/inventory/movements/route";
import { GET as listPurchases, POST as recordPurchase } from "@/app/api/inventory/purchases/route";
import { GET as inventoryReport } from "@/app/api/inventory/reports/route";
import { GET as listSuppliers, POST as createSupplier } from "@/app/api/inventory/suppliers/route";
import { prisma } from "@/lib/prisma";
import { addClinicDays, getClinicDateKey } from "@/lib/clinic-date";
import { call, createSession, type TestUser } from "./helpers";

let admin: TestUser;
let receptionist: TestUser;
const today = getClinicDateKey(new Date());
const inDays = (days: number) => addClinicDays(today, days);

const newItem = async (name: string, extra: Record<string, unknown> = {}) => {
  const response = await call(createItem, "/api/inventory/items", { method: "POST", cookie: admin.cookie, body: { name, unit: "pcs", ...extra } });
  expect(response.status).toBe(201);
  return response.json.item.id as string;
};
const buy = (lines: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
  call(recordPurchase, "/api/inventory/purchases", { method: "POST", cookie: admin.cookie, body: { purchasedAt: today, lines, ...extra } });
const move = (body: Record<string, unknown>, cookie = admin.cookie) => call(moveStock, "/api/inventory/movements", { method: "POST", cookie, body });
const onHand = async (id: string) => (await prisma.inventoryItem.findUniqueOrThrow({ where: { id } })).quantity;
const batchSum = async (id: string) => (await prisma.stockBatch.aggregate({ where: { itemId: id }, _sum: { quantityRemaining: true } }))._sum.quantityRemaining ?? 0;

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
});

describe("inventory access", () => {
  it("rejects anonymous callers and lets reception read but not change stock", async () => {
    expect((await call(listItems, "/api/inventory/items")).status).toBe(401);
    expect((await call(listItems, "/api/inventory/items", { cookie: receptionist.cookie })).status).toBe(200);
    expect((await call(createItem, "/api/inventory/items", { method: "POST", cookie: receptionist.cookie, body: { name: "Nope item" } })).status).toBe(403);
    expect((await call(recordPurchase, "/api/inventory/purchases", { method: "POST", cookie: receptionist.cookie, body: {} })).status).toBe(403);
    expect((await call(moveStock, "/api/inventory/movements", { method: "POST", cookie: receptionist.cookie, body: {} })).status).toBe(403);
  });
});

describe("items", () => {
  it("creates items with generated codes and refuses duplicate names", async () => {
    const response = await call(createItem, "/api/inventory/items", { method: "POST", cookie: admin.cookie, body: { name: "Lidocaine 2%", unit: "vial", reorderLevel: 5 } });
    expect(response.status).toBe(201);
    expect(response.json.item.sku).toMatch(/^ITM-\d{4}$/);
    expect(response.json.item.quantity).toBe(0);
    expect((await call(createItem, "/api/inventory/items", { method: "POST", cookie: admin.cookie, body: { name: "Lidocaine 2%", unit: "vial" } })).status).toBe(409);
  });

  it("validates input", async () => {
    expect((await call(createItem, "/api/inventory/items", { method: "POST", cookie: admin.cookie, body: { name: "x" } })).status).toBe(400);
    expect((await call(createItem, "/api/inventory/items", { method: "POST", cookie: admin.cookie, body: { name: "Valid name", reorderLevel: -1 } })).status).toBe(400);
  });

  it("edits and deactivates an item", async () => {
    const id = await newItem("Edit me");
    const edited = await call(updateItem, `/api/inventory/items/${id}`, { method: "PATCH", cookie: admin.cookie, params: { id }, body: { reorderLevel: 9, isActive: false } });
    expect(edited.status).toBe(200);
    expect(edited.json.item.isActive).toBe(false);
    const missing = await call(updateItem, "/api/inventory/items/nope", { method: "PATCH", cookie: admin.cookie, params: { id: "nope" }, body: { reorderLevel: 1 } });
    expect(missing.status).toBe(404);
  });
});

describe("purchases and stock", () => {
  it("adds batches, raises the on-hand quantity and records the purchase as a supplies expense", async () => {
    const supplier = await call(createSupplier, "/api/inventory/suppliers", { method: "POST", cookie: admin.cookie, body: { name: "Dental House Ltd" } });
    expect(supplier.status).toBe(201);
    const id = await newItem("Composite resin");
    const purchase = await buy([{ itemId: id, quantity: 10, unitCost: 250.5, batchNumber: "B-1", expiryDate: inDays(200) }], { supplierId: supplier.json.supplier.id, invoiceNumber: "INV-77", paymentMethod: "CARD" });
    expect(purchase.status).toBe(201);
    expect(purchase.json.purchase.purchaseCode).toMatch(/^PUR-\d{5}$/);
    expect(purchase.json.purchase.totalCost).toBe("2505");
    expect(await onHand(id)).toBe(10);
    const expense = await prisma.expense.findFirstOrThrow({ where: { stockPurchase: { id: purchase.json.purchase.id } } });
    expect(expense.category).toBe("SUPPLIES");
    expect(expense.method).toBe("CARD");
    expect(Number(expense.amount)).toBe(2505);
    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id } });
    expect(Number(item.unitCost)).toBe(250.5);

    const list = await call(listPurchases, "/api/inventory/purchases", { cookie: admin.cookie });
    expect(list.json.purchases.some((row: { id: string }) => row.id === purchase.json.purchase.id)).toBe(true);
    const suppliers = await call(listSuppliers, "/api/inventory/suppliers", { cookie: admin.cookie });
    const row = suppliers.json.suppliers.find((entry: { id: string }) => entry.id === supplier.json.supplier.id);
    expect(row.purchaseCount).toBe(1);
    expect(row.totalPurchased).toBe("2505.00");
  });

  it("can skip the expense, and rejects bad purchases", async () => {
    const id = await newItem("No expense item");
    const before = await prisma.expense.count();
    expect((await buy([{ itemId: id, quantity: 2, unitCost: 10 }], { recordExpense: false })).status).toBe(201);
    expect(await prisma.expense.count()).toBe(before);
    expect((await buy([])).status).toBe(400);
    expect((await buy([{ itemId: id, quantity: 0, unitCost: 10 }])).status).toBe(400);
    expect((await buy([{ itemId: "missing", quantity: 1, unitCost: 10 }])).status).toBe(404);
    expect((await buy([{ itemId: id, quantity: 1, unitCost: 10 }], { purchasedAt: inDays(5) })).status).toBe(400);
    expect((await buy([{ itemId: id, quantity: 1, unitCost: 10, expiryDate: today }])).status).toBe(400);
  });

  it("rolls back the whole purchase when one line fails", async () => {
    const id = await newItem("Atomic item");
    const purchasesBefore = await prisma.stockPurchase.count();
    const expensesBefore = await prisma.expense.count();
    const response = await buy([{ itemId: id, quantity: 3, unitCost: 5 }, { itemId: "missing", quantity: 1, unitCost: 5 }]);
    expect(response.status).toBe(404);
    expect(await onHand(id)).toBe(0);
    expect(await prisma.stockPurchase.count()).toBe(purchasesBefore);
    expect(await prisma.expense.count()).toBe(expensesBefore);
  });

  it("uses the oldest expiry first and never goes below zero", async () => {
    const id = await newItem("FEFO item");
    await buy([{ itemId: id, quantity: 5, unitCost: 1, expiryDate: inDays(300) }, { itemId: id, quantity: 5, unitCost: 1, expiryDate: inDays(60) }, { itemId: id, quantity: 5, unitCost: 1 }], { recordExpense: false });
    expect((await move({ itemId: id, kind: "ISSUE", quantity: 7, reason: "Fillings" })).status).toBe(201);
    const batches = await prisma.stockBatch.findMany({ where: { itemId: id }, orderBy: { expiryDate: { sort: "asc", nulls: "last" } } });
    expect(batches.map((batch) => batch.quantityRemaining)).toEqual([0, 3, 5]);
    expect(await onHand(id)).toBe(8);
    expect(await batchSum(id)).toBe(8);

    const tooMany = await move({ itemId: id, kind: "ISSUE", quantity: 9, reason: "Too many" });
    expect(tooMany.status).toBe(409);
    expect(tooMany.json.error).toMatch(/Only 8/);
    expect(await onHand(id)).toBe(8);
  });

  it("never issues expired stock; a write-off adjustment removes it and is recorded", async () => {
    const id = await newItem("Expiry item");
    // Expired lot created directly: a purchase cannot carry an expiry that is already past.
    await prisma.$transaction([
      prisma.stockBatch.create({ data: { itemId: id, quantityReceived: 4, quantityRemaining: 4, unitCost: 2, expiryDate: new Date(`${inDays(-10)}T00:00:00.000Z`) } }),
      prisma.inventoryItem.update({ where: { id }, data: { quantity: 4 } }),
    ]);
    const issue = await move({ itemId: id, kind: "ISSUE", quantity: 1, reason: "Try expired" });
    expect(issue.status).toBe(409);
    expect(issue.json.error).toMatch(/expired/i);

    const lot = await prisma.stockBatch.findFirstOrThrow({ where: { itemId: id } });
    const writeOff = await move({ itemId: id, kind: "ADJUST_OUT", quantity: 4, batchId: lot.id, reason: "Expired write-off" });
    expect(writeOff.status).toBe(201);
    expect(await onHand(id)).toBe(0);
    const movement = await prisma.stockMovement.findFirstOrThrow({ where: { itemId: id, type: "ADJUSTMENT" } });
    expect(movement.quantity).toBe(-4);
    expect(movement.reason).toBe("Expired write-off");
  });

  it("adds stock with an adjustment and keeps the batch total equal to the on-hand quantity", async () => {
    const id = await newItem("Adjust item");
    expect((await move({ itemId: id, kind: "ADJUST_IN", quantity: 12, reason: "Opening balance", expiryDate: inDays(90) })).status).toBe(201);
    expect(await onHand(id)).toBe(12);
    expect(await batchSum(id)).toBe(12);
    expect((await move({ itemId: id, kind: "ADJUST_OUT", quantity: 2, reason: "Damaged" })).status).toBe(201);
    expect(await onHand(id)).toBe(10);
    expect(await batchSum(id)).toBe(10);
    expect((await move({ itemId: id, kind: "ADJUST_IN", quantity: 1, reason: "Past expiry", expiryDate: inDays(-1) })).status).toBe(400);
    expect((await move({ itemId: id, kind: "ISSUE", quantity: 1, reason: "x" })).status).toBe(400);
    expect((await move({ itemId: "missing", kind: "ISSUE", quantity: 1, reason: "Missing item" })).status).toBe(404);
  });

  it("keeps stock correct when two people use it at the same time", async () => {
    const id = await newItem("Race item");
    await buy([{ itemId: id, quantity: 5, unitCost: 1 }], { recordExpense: false });
    const results = await Promise.all(Array.from({ length: 4 }, () => move({ itemId: id, kind: "ISSUE", quantity: 2, reason: "Parallel use" })));
    expect(results.filter((result) => result.status === 201)).toHaveLength(2);
    expect(results.filter((result) => result.status === 409)).toHaveLength(2);
    expect(await onHand(id)).toBe(1);
    expect(await batchSum(id)).toBe(1);
  });
});

describe("alerts, history and reports", () => {
  it("flags low, out-of-stock, expiring and expired items with a stock value", async () => {
    const low = await newItem("Alert low", { reorderLevel: 5 });
    const out = await newItem("Alert out");
    const soon = await newItem("Alert soon");
    await buy([{ itemId: low, quantity: 3, unitCost: 10 }, { itemId: soon, quantity: 2, unitCost: 100, expiryDate: inDays(10) }], { recordExpense: false });
    const response = await call(listItems, "/api/inventory/items", { cookie: admin.cookie });
    expect(response.status).toBe(200);
    const byName = (name: string) => response.json.items.find((item: { name: string }) => item.name === name);
    expect(byName("Alert low").status).toBe("LOW");
    expect(byName("Alert out").status).toBe("OUT");
    expect(byName("Alert soon").status).toBe("OK");
    expect(byName("Alert soon").expiringQuantity).toBe(2);
    expect(byName("Alert soon").nextExpiry).toBe(inDays(10));
    expect(response.json.summary.low).toBeGreaterThanOrEqual(1);
    expect(Number(response.json.summary.stockValue)).toBeGreaterThanOrEqual(230);
    void out;
  });

  it("lists movements and builds a period report", async () => {
    const id = await newItem("Report item");
    await buy([{ itemId: id, quantity: 20, unitCost: 4 }], { recordExpense: false });
    await move({ itemId: id, kind: "ISSUE", quantity: 6, reason: "Routine use" });
    await move({ itemId: id, kind: "ADJUST_OUT", quantity: 2, reason: "Broken" });

    const history = await call(listMovements, `/api/inventory/movements?itemId=${id}`, { cookie: admin.cookie });
    expect(history.status).toBe(200);
    expect(history.json.movements.map((row: { type: string; quantity: number }) => [row.type, row.quantity])).toEqual(
      expect.arrayContaining([["PURCHASE", 20], ["ISSUE", -6], ["ADJUSTMENT", -2]]),
    );
    expect((await call(listMovements, "/api/inventory/movements?type=BOGUS", { cookie: admin.cookie })).status).toBe(400);

    const report = await call(inventoryReport, `/api/inventory/reports?from=${today}&to=${today}`, { cookie: admin.cookie });
    expect(report.status).toBe(200);
    const used = report.json.usage.find((row: { id: string }) => row.id === id);
    expect(used.quantity).toBe(6);
    expect(used.cost).toBe("24.00");
    expect(report.json.adjustments.lostQuantity).toBeGreaterThanOrEqual(2);
    expect((await call(inventoryReport, "/api/inventory/reports?from=2026-02-01&to=2026-01-01", { cookie: admin.cookie })).status).toBe(400);
  });
});
