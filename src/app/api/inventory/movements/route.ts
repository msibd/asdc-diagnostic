import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody, parseQuery } from "@/lib/api";
import { addClinicDays } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";
import { InventoryError, applyMovement } from "@/modules/inventory/inventory-service";
import { movementInputSchema, movementListQuerySchema } from "@/modules/inventory/inventory-schema";

const PAGE_SIZE = 100;

export async function GET(request: Request) {
  const access = await authorize(request.headers, "inventory:read");
  if (!access.session) return apiError(access.error, access.status);
  const query = parseQuery(request, movementListQuerySchema);
  if (!query.ok) return query.response;
  const { itemId, type, from, to, cursor } = query.data;
  if (from && to && from > to) return apiError("The start date must be on or before the end date.", 400);
  const rows = await prisma.stockMovement.findMany({
    where: {
      ...(itemId ? { itemId } : {}),
      ...(type ? { type } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00+06:00`) } : {}), ...(to ? { lt: new Date(`${addClinicDays(to, 1)}T00:00:00+06:00`) } : {}) } } : {}),
    },
    select: {
      id: true, type: true, quantity: true, unitCost: true, reason: true, createdAt: true,
      item: { select: { id: true, name: true, unit: true } },
      batch: { select: { batchNumber: true, expiryDate: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: PAGE_SIZE + 1,
  });
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return NextResponse.json({
    movements: page.map((row) => ({
      ...row,
      unitCost: row.unitCost?.toString() ?? null,
      batch: row.batch ? { ...row.batch, expiryDate: row.batch.expiryDate?.toISOString().slice(0, 10) ?? null } : null,
    })),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
  });
}

// Use stock in the clinic, or correct the count (stock-take difference, damage, expiry write-off).
export async function POST(request: Request) {
  const access = await authorize(request.headers, "inventory:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, movementInputSchema, "Invalid stock change.");
  if (!body.ok) return body.response;
  try {
    const item = await applyMovement({ request, userId: access.session.user.id }, body.data);
    return NextResponse.json({ item: { id: item.id, quantity: item.quantity } }, { status: 201 });
  } catch (error) {
    if (error instanceof InventoryError) return apiError(error.message, error.status);
    throw error;
  }
}
