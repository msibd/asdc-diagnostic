import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, isPrismaError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { itemUpdateSchema } from "@/modules/inventory/inventory-schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "inventory:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, itemUpdateSchema, "Invalid item.");
  if (!body.ok) return body.response;
  const { id } = await params;
  if (body.data.supplierId && !(await prisma.supplier.findUnique({ where: { id: body.data.supplierId }, select: { id: true } }))) {
    return apiError("Supplier not found.", 404);
  }
  try {
    const item = await prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({ where: { id }, data: body.data });
      await writeAuditEvent(request, access.session.user.id, "UPDATE", "InventoryItem", id, { name: updated.name, isActive: updated.isActive }, tx);
      return updated;
    });
    return NextResponse.json({ item: { ...item, unitCost: item.unitCost.toString() } });
  } catch (error) {
    if (isPrismaError(error, "P2025")) return apiError("Item not found.", 404);
    if (isPrismaError(error, "P2002")) return apiError("An item with this name already exists.", 409);
    throw error;
  }
}
