import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, isPrismaError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { supplierInputSchema } from "@/modules/inventory/inventory-schema";

export async function GET(request: Request) {
  const access = await authorize(request.headers, "inventory:read");
  if (!access.session) return apiError(access.error, access.status);
  const [suppliers, totals] = await Promise.all([
    prisma.supplier.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }], take: 500, include: { _count: { select: { items: true, purchases: true } } } }),
    prisma.stockPurchase.groupBy({ by: ["supplierId"], orderBy: { supplierId: "asc" }, _sum: { totalCost: true } }),
  ]);
  const spent = new Map(totals.map((row) => [row.supplierId, Number(row._sum.totalCost ?? 0)]));
  return NextResponse.json({
    suppliers: suppliers.map(({ _count, ...supplier }) => ({
      ...supplier, itemCount: _count.items, purchaseCount: _count.purchases, totalPurchased: (spent.get(supplier.id) ?? 0).toFixed(2),
    })),
  });
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "inventory:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, supplierInputSchema, "Invalid supplier.");
  if (!body.ok) return body.response;
  try {
    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({ data: body.data });
      await writeAuditEvent(request, access.session.user.id, "CREATE", "Supplier", created.id, { name: created.name }, tx);
      return created;
    });
    return NextResponse.json({ supplier }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return apiError("A supplier with this name already exists.", 409);
    throw error;
  }
}
