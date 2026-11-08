import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, parseQuery } from "@/lib/api";
import { addClinicDays } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";
import { dateOnly } from "@/modules/inventory/inventory-service";
import { reportQuerySchema } from "@/modules/inventory/inventory-schema";

// Stock report for a period: what was bought, what was used, what was written off, and what the
// stock on the shelf is worth now.
export async function GET(request: Request) {
  const access = await authorize(request.headers, "inventory:read");
  if (!access.session) return apiError(access.error, access.status);
  const query = parseQuery(request, reportQuerySchema, "Valid from and to dates are required.");
  if (!query.ok) return query.response;
  const { from, to } = query.data;
  if (from > to) return apiError("The start date must be on or before the end date.", 400);
  const start = new Date(`${from}T00:00:00+06:00`);
  const end = new Date(`${addClinicDays(to, 1)}T00:00:00+06:00`);
  if (end.getTime() - start.getTime() > 366 * 86_400_000) return apiError("Date range must be no longer than 366 days.", 400);

  const [usage, adjustments, purchasesBySupplier, purchaseTotal, valueByCategory] = await Promise.all([
    prisma.$queryRaw<{ id: string; name: string; unit: string; used: number; cost: string }[]>`
      SELECT item.id, item.name, item.unit, (-SUM(m.quantity))::int AS used,
             COALESCE(-SUM(m.quantity * m."unitCost"), 0)::text AS cost
      FROM "StockMovement" m JOIN "InventoryItem" item ON item.id = m."itemId"
      WHERE m.type = 'ISSUE' AND m."createdAt" >= ${start} AND m."createdAt" < ${end}
      GROUP BY item.id, item.name, item.unit ORDER BY used DESC LIMIT 50`,
    prisma.$queryRaw<{ lostQuantity: number; lostValue: string; foundQuantity: number }[]>`
      SELECT COALESCE(-SUM(quantity) FILTER (WHERE quantity < 0), 0)::int AS "lostQuantity",
             COALESCE(-SUM(quantity * "unitCost") FILTER (WHERE quantity < 0), 0)::text AS "lostValue",
             COALESCE(SUM(quantity) FILTER (WHERE quantity > 0), 0)::int AS "foundQuantity"
      FROM "StockMovement" WHERE type = 'ADJUSTMENT' AND "createdAt" >= ${start} AND "createdAt" < ${end}`,
    prisma.$queryRaw<{ name: string | null; total: string; count: number }[]>`
      SELECT supplier.name, SUM(p."totalCost")::text AS total, COUNT(*)::int AS count
      FROM "StockPurchase" p LEFT JOIN "Supplier" supplier ON supplier.id = p."supplierId"
      WHERE p."purchasedAt" >= ${dateOnly(from)} AND p."purchasedAt" <= ${dateOnly(to)}
      GROUP BY supplier.name ORDER BY SUM(p."totalCost") DESC`,
    prisma.stockPurchase.aggregate({ where: { purchasedAt: { gte: dateOnly(from), lte: dateOnly(to) } }, _sum: { totalCost: true }, _count: { _all: true } }),
    prisma.$queryRaw<{ category: string; items: number; value: string }[]>`
      SELECT item.category, COUNT(DISTINCT item.id)::int AS items,
             COALESCE(SUM(batch."quantityRemaining" * batch."unitCost"), 0)::text AS value
      FROM "InventoryItem" item LEFT JOIN "StockBatch" batch ON batch."itemId" = item.id AND batch."quantityRemaining" > 0
      WHERE item."isActive" GROUP BY item.category ORDER BY item.category`,
  ]);

  return NextResponse.json({
    range: { from, to },
    purchases: {
      total: Number(purchaseTotal._sum.totalCost ?? 0).toFixed(2),
      count: purchaseTotal._count._all,
      bySupplier: purchasesBySupplier.map((row) => ({ supplier: row.name ?? "No supplier", total: row.total, count: row.count })),
    },
    usage: usage.map((row) => ({ id: row.id, name: row.name, unit: row.unit, quantity: row.used, cost: Number(row.cost).toFixed(2) })),
    adjustments: {
      lostQuantity: adjustments[0]?.lostQuantity ?? 0,
      lostValue: Number(adjustments[0]?.lostValue ?? 0).toFixed(2),
      foundQuantity: adjustments[0]?.foundQuantity ?? 0,
    },
    stockValueByCategory: valueByCategory.map((row) => ({ category: row.category, items: row.items, value: Number(row.value).toFixed(2) })),
  });
}
