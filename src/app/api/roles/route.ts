import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, isPrismaError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { ADMIN_ROLE_KEY, NO_ACCESS_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles, invalidateRoleCache } from "@/lib/roles";
import { roleCreateSchema, roleKeyFromName } from "@/modules/access/access-schema";

export async function GET(request: Request) {
  const access = await authorize(request.headers, "roles:manage");
  if (!access.session) return apiError(access.error, access.status);
  await ensureSystemRoles();
  const [roles, counts] = await Promise.all([
    prisma.role.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] }),
    prisma.user.groupBy({ by: ["role"], orderBy: { role: "asc" }, _count: { _all: true } }),
  ]);
  const users = new Map(counts.map((row) => [row.role, row._count._all]));
  return NextResponse.json({
    roles: roles.map((role) => ({
      id: role.id, key: role.key, name: role.name, description: role.description,
      permissions: role.permissions, isSystem: role.isSystem, locked: role.key === ADMIN_ROLE_KEY,
      userCount: users.get(role.key) ?? 0,
    })),
  });
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "roles:manage");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, roleCreateSchema, "Invalid role.");
  if (!body.ok) return body.response;
  const key = roleKeyFromName(body.data.name);
  if (!key || key === ADMIN_ROLE_KEY || key === NO_ACCESS_ROLE) return apiError("Choose a different role name.", 400);
  try {
    await ensureSystemRoles();
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: { key, name: body.data.name, description: body.data.description, permissions: body.data.permissions, isSystem: false },
      });
      await writeAuditEvent(request, access.session.user.id, "CREATE", "Role", created.id, { key, permissions: created.permissions.length }, tx);
      return created;
    });
    invalidateRoleCache();
    return NextResponse.json({ role }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return apiError("A role with this name already exists.", 409);
    throw error;
  }
}
