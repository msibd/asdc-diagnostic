import { prisma } from "@/lib/prisma";
import { addClinicDays, getClinicDateKey } from "@/lib/clinic-date";
import { writeAuditEvent } from "@/lib/audit";
import { EXPIRY_WARNING_DAYS, type MovementInput, type PurchaseInput } from "@/modules/inventory/inventory-schema";

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** A rule of the stock book was broken (not enough stock, unknown item…). Becomes a 4xx response. */
export class InventoryError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 409) {
    super(message);
    this.name = "InventoryError";
  }
}

export const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);
const cents = (value: number) => Math.round(value * 100);

type Actor = { request: Request; userId: string };

/** Locks the item row so two people changing the same stock at once cannot both read the old total. */
async function lockItem(tx: Tx, itemId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "InventoryItem" WHERE id = ${itemId} FOR UPDATE`;
  if (!rows.length) throw new InventoryError("Item not found.", 404);
  return tx.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
}

async function addBatch(tx: Tx, args: {
  itemId: string; quantity: number; unitCost: number; type: "PURCHASE" | "ADJUSTMENT";
  purchaseId?: string; batchNumber?: string | null; expiryDate?: string | null; reason?: string; userId: string;
}) {
  const batch = await tx.stockBatch.create({
    data: {
      itemId: args.itemId,
      purchaseId: args.purchaseId,
      batchNumber: args.batchNumber ?? null,
      expiryDate: args.expiryDate ? dateOnly(args.expiryDate) : null,
      quantityReceived: args.quantity,
      quantityRemaining: args.quantity,
      unitCost: args.unitCost,
    },
  });
  await tx.stockMovement.create({
    data: {
      itemId: args.itemId, batchId: batch.id, type: args.type, quantity: args.quantity,
      unitCost: args.unitCost, reason: args.reason ?? null, createdById: args.userId,
    },
  });
  await tx.inventoryItem.update({
    where: { id: args.itemId },
    data: { quantity: { increment: args.quantity }, ...(args.type === "PURCHASE" ? { unitCost: args.unitCost } : {}) },
  });
  return batch;
}

/**
 * Takes stock out, oldest expiry first (lots without an expiry last). Issuing never uses expired
 * lots; they must be written off with an adjustment so the loss is on record.
 */
async function removeStock(tx: Tx, args: {
  itemId: string; quantity: number; type: "ISSUE" | "ADJUSTMENT"; reason: string; userId: string; batchId?: string | null; today: string;
}) {
  const item = await lockItem(tx, args.itemId);
  if (!item.isActive && args.type === "ISSUE") throw new InventoryError("This item is inactive.");
  const batches = await tx.stockBatch.findMany({
    where: {
      itemId: args.itemId,
      quantityRemaining: { gt: 0 },
      ...(args.batchId ? { id: args.batchId } : {}),
      // Issuing skips expired lots; an adjustment (write-off) can take any lot.
      ...(args.type === "ISSUE" ? { OR: [{ expiryDate: null }, { expiryDate: { gte: dateOnly(args.today) } }] } : {}),
    },
    orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { receivedAt: "asc" }],
  });
  if (args.batchId && !batches.length) throw new InventoryError("That batch has no stock left.");
  const available = batches.reduce((sum, batch) => sum + batch.quantityRemaining, 0);
  if (available < args.quantity) {
    const note = args.type === "ISSUE" && item.quantity > available ? ` (${item.quantity - available} more are expired: write them off with an adjustment)` : "";
    throw new InventoryError(`Only ${available} ${item.unit} of ${item.name} can be used${note}.`);
  }
  let left = args.quantity;
  for (const batch of batches) {
    if (left <= 0) break;
    const take = Math.min(left, batch.quantityRemaining);
    await tx.stockBatch.update({ where: { id: batch.id }, data: { quantityRemaining: { decrement: take } } });
    await tx.stockMovement.create({
      data: { itemId: item.id, batchId: batch.id, type: args.type, quantity: -take, unitCost: batch.unitCost, reason: args.reason, createdById: args.userId },
    });
    left -= take;
  }
  await tx.inventoryItem.update({ where: { id: item.id }, data: { quantity: { decrement: args.quantity } } });
}

export async function applyMovement({ request, userId }: Actor, input: MovementInput) {
  const today = getClinicDateKey(new Date());
  return prisma.$transaction(async (tx) => {
    if (input.kind === "ADJUST_IN") {
      const item = await lockItem(tx, input.itemId);
      if (input.expiryDate && input.expiryDate < today) throw new InventoryError("The expiry date is already past.", 400);
      await addBatch(tx, {
        itemId: item.id, quantity: input.quantity, unitCost: Number(item.unitCost), type: "ADJUSTMENT",
        expiryDate: input.expiryDate, reason: input.reason, userId,
      });
    } else {
      await removeStock(tx, {
        itemId: input.itemId, quantity: input.quantity, type: input.kind === "ISSUE" ? "ISSUE" : "ADJUSTMENT",
        reason: input.reason, userId, batchId: input.batchId, today,
      });
    }
    await writeAuditEvent(request, userId, input.kind, "InventoryItem", input.itemId, { quantity: input.quantity, reason: input.reason }, tx);
    return tx.inventoryItem.findUniqueOrThrow({ where: { id: input.itemId } });
  });
}

export async function recordPurchase({ request, userId }: Actor, input: PurchaseInput) {
  const today = getClinicDateKey(new Date());
  if (input.purchasedAt > addClinicDays(today, 1)) throw new InventoryError("A purchase cannot be dated in the future.", 400);
  for (const line of input.lines) {
    if (line.expiryDate && line.expiryDate <= input.purchasedAt) throw new InventoryError("An expiry date must be after the purchase date.", 400);
  }
  const totalCents = input.lines.reduce((sum, line) => sum + cents(line.unitCost) * line.quantity, 0);

  return prisma.$transaction(async (tx) => {
    if (input.supplierId) {
      const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId }, select: { isActive: true, name: true } });
      if (!supplier) throw new InventoryError("Supplier not found.", 404);
    }
    const [sequence] = await tx.$queryRaw<{ value: string }[]>`SELECT nextval('"stock_purchase_seq"')::text AS value`;
    const purchaseCode = `PUR-${sequence.value.padStart(5, "0")}`;
    const supplierName = input.supplierId ? (await tx.supplier.findUniqueOrThrow({ where: { id: input.supplierId }, select: { name: true } })).name : null;

    let expenseId: string | null = null;
    if (input.recordExpense && totalCents > 0) {
      const expense = await tx.expense.create({
        data: {
          category: "SUPPLIES",
          description: `Stock purchase ${purchaseCode}${supplierName ? ` from ${supplierName}` : ""}`,
          amount: totalCents / 100,
          spentAt: dateOnly(input.purchasedAt),
          method: input.paymentMethod,
          reference: input.invoiceNumber,
          createdById: userId,
        },
      });
      expenseId = expense.id;
    }
    const purchase = await tx.stockPurchase.create({
      data: {
        purchaseCode, supplierId: input.supplierId, invoiceNumber: input.invoiceNumber,
        purchasedAt: dateOnly(input.purchasedAt), totalCost: totalCents / 100, note: input.note,
        expenseId, createdById: userId,
      },
    });
    for (const line of input.lines) {
      const item = await lockItem(tx, line.itemId);
      if (!item.isActive) throw new InventoryError(`${item.name} is inactive.`);
      await addBatch(tx, {
        itemId: item.id, quantity: line.quantity, unitCost: line.unitCost, type: "PURCHASE", purchaseId: purchase.id,
        batchNumber: line.batchNumber, expiryDate: line.expiryDate, reason: purchaseCode, userId,
      });
    }
    await writeAuditEvent(request, userId, "PURCHASE", "StockPurchase", purchase.id, { code: purchaseCode, total: (totalCents / 100).toFixed(2) }, tx);
    return purchase;
  });
}

// ---- derived stock state --------------------------------------------------------------------

export type StockStatus = "OUT" | "LOW" | "OK";

export const stockStatus = (quantity: number, reorderLevel: number): StockStatus =>
  quantity <= 0 ? "OUT" : reorderLevel > 0 && quantity <= reorderLevel ? "LOW" : "OK";

export function expiryState(expiryDate: Date | null, today: string): "EXPIRED" | "SOON" | "OK" {
  if (!expiryDate) return "OK";
  const key = expiryDate.toISOString().slice(0, 10);
  if (key < today) return "EXPIRED";
  return key <= addClinicDays(today, EXPIRY_WARNING_DAYS) ? "SOON" : "OK";
}
