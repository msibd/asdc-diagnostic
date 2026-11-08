import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, isPrismaError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { ADMIN_ROLE_KEY } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { invalidateRoleCache } from "@/lib/roles";
import { roleUpdateSchema } from "@/modules/access/access-schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "roles:manage");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, roleUpdateSchema, "Invalid role.");
  if (!body.ok) return body.response;
  const { id } = await params;
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) return apiError("Role not found.", 404);
  // The administrator role always holds everything, so a mistaken edit can never lock everyone out.
  if (existing.key === ADMIN_ROLE_KEY) return apiError("The administrator role cannot be changed.", 409);
  try {
    const role = await prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({ where: { id }, data: body.data });
      await writeAuditEvent(request, access.session.user.id, "UPDATE", "Role", id, {
        key: updated.key, permissions: updated.permissions.length,
      }, tx);
      return updated;
    });
    invalidateRoleCache();
    return NextResponse.json({ role });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return apiError("A role with this name already exists.", 409);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "roles:manage");
  if (!access.session) return apiError(access.error, access.status);
  const { id } = await params;
  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) return apiError("Role not found.", 404);
  if (existing.isSystem) return apiError("Built-in roles cannot be deleted. Remove their permissions instead.", 409);
  const inUse = await prisma.user.count({ where: { role: existing.key } });
  if (inUse) return apiError(`${inUse} staff account${inUse === 1 ? " uses" : "s use"} this role. Move them to another role first.`, 409);
  await prisma.$transaction(async (tx) => {
    await tx.role.delete({ where: { id } });
    await writeAuditEvent(request, access.session.user.id, "DELETE", "Role", id, { key: existing.key }, tx);
  });
  invalidateRoleCache();
  return NextResponse.json({ success: true });
}
