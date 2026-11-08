import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, isPrismaError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { ADMIN_ROLE_KEY, NO_ACCESS_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/roles";
import { userUpdateSchema } from "@/modules/access/access-schema";

// Edits a staff account: name, role, and whether it is active. Deactivating signs the person out
// everywhere and blocks sign-in; the account and its history stay.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "users:manage");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, userUpdateSchema, "Invalid change.");
  if (!body.ok) return body.response;
  const { id } = await params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true, isActive: true } });
  if (!target) return apiError("Account not found.", 404);

  const { name, email, phone, role, isActive } = body.data;
  const demoting = role !== undefined && role !== target.role;
  const deactivating = isActive === false && target.isActive;
  if (id === access.session.user.id && (demoting || deactivating)) {
    return apiError("You cannot change your own role or deactivate your own account.", 409);
  }
  if (role !== undefined) {
    await ensureSystemRoles();
    if (role === NO_ACCESS_ROLE || !(await prisma.role.findUnique({ where: { key: role }, select: { id: true } }))) {
      return apiError("Choose an existing role.", 400);
    }
  }

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      // The clinic must always keep one active administrator.
      if (target.role === ADMIN_ROLE_KEY && target.isActive && ((demoting && role !== ADMIN_ROLE_KEY) || deactivating)) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(41680272)`;
        const others = await tx.user.count({ where: { role: ADMIN_ROLE_KEY, isActive: true, id: { not: id } } });
        if (!others) return null;
      }
      const updated = await tx.user.update({
        where: { id },
        data: { ...(name !== undefined ? { name } : {}), ...(email !== undefined ? { email } : {}), ...(phone !== undefined ? { phone: phone || null } : {}), ...(role !== undefined ? { role } : {}), ...(isActive !== undefined ? { isActive } : {}) },
        select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
      });
      if (deactivating) await tx.session.deleteMany({ where: { userId: id } });
      await writeAuditEvent(request, access.session.user.id, deactivating ? "DEACTIVATE" : isActive === true && !target.isActive ? "ACTIVATE" : "UPDATE", "User", id, {
        email: updated.email, role: updated.role,
      }, tx);
      return updated;
    });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return apiError("Another account already uses this e-mail.", 409);
    throw error;
  }
  if (!user) return apiError("At least one active administrator is required.", 409);
  return NextResponse.json({ user });
}
