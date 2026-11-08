import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, isPrismaError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { supplierUpdateSchema } from "@/modules/inventory/inventory-schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "inventory:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, supplierUpdateSchema, "Invalid supplier.");
  if (!body.ok) return body.response;
  const { id } = await params;
  try {
    const supplier = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({ where: { id }, data: body.data });
      await writeAuditEvent(request, access.session.user.id, "UPDATE", "Supplier", id, { name: updated.name, isActive: updated.isActive }, tx);
      return updated;
    });
    return NextResponse.json({ supplier });
  } catch (error) {
    if (isPrismaError(error, "P2025")) return apiError("Supplier not found.", 404);
    if (isPrismaError(error, "P2002")) return apiError("A supplier with this name already exists.", 409);
    throw error;
  }
}
