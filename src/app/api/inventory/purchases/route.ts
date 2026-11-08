import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody, parseQuery } from "@/lib/api";
import { getClinicDateKey } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";
import { InventoryError, dateOnly, recordPurchase } from "@/modules/inventory/inventory-service";
import { purchaseInputSchema, purchaseListQuerySchema } from "@/modules/inventory/inventory-schema";

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  const access = await authorize(request.headers, "inventory:read");
  if (!access.session) return apiError(access.error, access.status);
  const query = parseQuery(request, purchaseListQuerySchema);
  if (!query.ok) return query.response;
  const today = getClinicDateKey(new Date());
  const from = query.data.from ?? `${today.slice(0, 7)}-01`;
  const to = query.data.to ?? today;
  if (from > to) return apiError("The start date must be on or before the end date.", 400);
  const where = { purchasedAt: { gte: dateOnly(from), lte: dateOnly(to) } };
  const [rows, total] = await Promise.all([
    prisma.stockPurchase.findMany({
      where,
      select: {
        id: true, purchaseCode: true, invoiceNumber: true, purchasedAt: true, totalCost: true, note: true,
        supplier: { select: { id: true, name: true } },
        expense: { select: { id: true, method: true, voidedAt: true } },
        batches: { select: { id: true, quantityReceived: true, unitCost: true, batchNumber: true, expiryDate: true, item: { select: { name: true, unit: true } } } },
      },
      orderBy: [{ purchasedAt: "desc" }, { id: "desc" }],
      ...(query.data.cursor ? { cursor: { id: query.data.cursor }, skip: 1 } : {}),
      take: PAGE_SIZE + 1,
    }),
    prisma.stockPurchase.aggregate({ where, _sum: { totalCost: true } }),
  ]);
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return NextResponse.json({
    range: { from, to },
    total: Number(total._sum.totalCost ?? 0).toFixed(2),
    purchases: page.map((row) => ({
      ...row,
      purchasedAt: row.purchasedAt.toISOString().slice(0, 10),
      totalCost: row.totalCost.toString(),
      batches: row.batches.map((batch) => ({ ...batch, unitCost: batch.unitCost.toString(), expiryDate: batch.expiryDate?.toISOString().slice(0, 10) ?? null })),
    })),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  });
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "inventory:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, purchaseInputSchema, "Invalid purchase.");
  if (!body.ok) return body.response;
  try {
    const purchase = await recordPurchase({ request, userId: access.session.user.id }, body.data);
    return NextResponse.json({ purchase: { id: purchase.id, purchaseCode: purchase.purchaseCode, totalCost: purchase.totalCost.toString() } }, { status: 201 });
  } catch (error) {
    if (error instanceof InventoryError) return apiError(error.message, error.status);
    throw error;
  }
}
