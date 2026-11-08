import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, isPrismaError, parseBody, parseQuery } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { getClinicDateKey } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";
import { expiryState, stockStatus } from "@/modules/inventory/inventory-service";
import { itemInputSchema, itemListQuerySchema } from "@/modules/inventory/inventory-schema";

const itemSelect = {
  id: true, sku: true, name: true, category: true, unit: true, quantity: true, reorderLevel: true,
  unitCost: true, notes: true, isActive: true, supplier: { select: { id: true, name: true } },
} as const;

// All items with their stock state, plus the numbers for the alert cards. A clinic stocks a few
// hundred items at most, so the whole list is returned and filtered in the browser.
export async function GET(request: Request) {
  const access = await authorize(request.headers, "inventory:read");
  if (!access.session) return apiError(access.error, access.status);
  const query = parseQuery(request, itemListQuerySchema);
  if (!query.ok) return query.response;
  const includeInactive = query.data.includeInactive === "true";
  const today = getClinicDateKey(new Date());

  const [items, batches, value] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: includeInactive ? {} : { isActive: true },
      select: itemSelect,
      orderBy: [{ name: "asc" }],
      take: 1000,
    }),
    prisma.stockBatch.findMany({
      where: { quantityRemaining: { gt: 0 }, item: includeInactive ? {} : { isActive: true } },
      select: { id: true, itemId: true, batchNumber: true, expiryDate: true, quantityRemaining: true, unitCost: true },
      orderBy: [{ expiryDate: { sort: "asc", nulls: "last" } }, { receivedAt: "asc" }],
    }),
    prisma.$queryRaw<{ value: string }[]>`
      SELECT COALESCE(SUM(batch."quantityRemaining" * batch."unitCost"), 0)::text AS value
      FROM "StockBatch" batch JOIN "InventoryItem" item ON item.id = batch."itemId"
      WHERE batch."quantityRemaining" > 0 AND item."isActive"
    `,
  ]);

  const batchesByItem = new Map<string, typeof batches>();
  for (const batch of batches) batchesByItem.set(batch.itemId, [...(batchesByItem.get(batch.itemId) ?? []), batch]);

  let low = 0; let out = 0; let expiring = 0; let expired = 0;
  const rows = items.map((item) => {
    const lots = (batchesByItem.get(item.id) ?? []).map((batch) => ({
      id: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate?.toISOString().slice(0, 10) ?? null,
      quantityRemaining: batch.quantityRemaining,
      expiry: expiryState(batch.expiryDate, today),
    }));
    const status = stockStatus(item.quantity, item.reorderLevel);
    const expiredQuantity = lots.filter((lot) => lot.expiry === "EXPIRED").reduce((sum, lot) => sum + lot.quantityRemaining, 0);
    const expiringQuantity = lots.filter((lot) => lot.expiry === "SOON").reduce((sum, lot) => sum + lot.quantityRemaining, 0);
    if (item.isActive) {
      if (status === "LOW") low += 1;
      if (status === "OUT") out += 1;
      if (expiredQuantity) expired += 1;
      if (expiringQuantity) expiring += 1;
    }
    return {
      ...item,
      unitCost: item.unitCost.toString(),
      status,
      expiredQuantity,
      expiringQuantity,
      nextExpiry: lots.find((lot) => lot.expiryDate)?.expiryDate ?? null,
      batches: lots,
    };
  });

  return NextResponse.json({
    today,
    summary: { itemCount: rows.filter((row) => row.isActive).length, low, out, expiring, expired, stockValue: Number(value[0]?.value ?? 0).toFixed(2) },
    items: rows,
  });
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "inventory:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, itemInputSchema, "Invalid item.");
  if (!body.ok) return body.response;
  if (body.data.supplierId && !(await prisma.supplier.findUnique({ where: { id: body.data.supplierId }, select: { id: true } }))) {
    return apiError("Supplier not found.", 404);
  }
  try {
    const item = await prisma.$transaction(async (tx) => {
      const [sequence] = await tx.$queryRaw<{ value: string }[]>`SELECT nextval('"inventory_sku_seq"')::text AS value`;
      const created = await tx.inventoryItem.create({
        data: { ...body.data, sku: `ITM-${sequence.value.padStart(4, "0")}` },
        select: itemSelect,
      });
      await writeAuditEvent(request, access.session.user.id, "CREATE", "InventoryItem", created.id, { name: created.name }, tx);
      return created;
    });
    return NextResponse.json({ item: { ...item, unitCost: item.unitCost.toString() } }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return apiError("An item with this name already exists.", 409);
    throw error;
  }
}
