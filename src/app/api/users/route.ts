import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { authorize } from "@/lib/admin-session";
import { apiError, isPrismaError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { NO_ACCESS_ROLE } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/roles";
import { userCreateSchema } from "@/modules/access/access-schema";

const userSelect = { id: true, name: true, email: true, role: true, isActive: true, phone: true, createdAt: true } as const;

export async function GET(request: Request) {
  const access = await authorize(request.headers, "users:manage");
  if (!access.session) return apiError(access.error, access.status);
  await ensureSystemRoles();
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      select: { ...userSelect, sessions: { select: { updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 1 } },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      take: 500,
    }),
    prisma.role.findMany({ select: { key: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const names = new Map(roles.map((role) => [role.key, role.name]));
  return NextResponse.json({
    currentUserId: access.session.user.id,
    roles,
    users: users.map(({ sessions, ...user }) => ({
      ...user,
      roleName: names.get(user.role) ?? (user.role === NO_ACCESS_ROLE ? "No access" : user.role),
      lastActiveAt: sessions[0]?.updatedAt.toISOString() ?? null,
    })),
  });
}

// Creates a staff account with a password the administrator hands over; the person can change it
// from the Security page. There is no public sign-up.
export async function POST(request: Request) {
  const access = await authorize(request.headers, "users:manage");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, userCreateSchema, "Invalid account.");
  if (!body.ok) return body.response;
  await ensureSystemRoles();
  if (body.data.role === NO_ACCESS_ROLE || !(await prisma.role.findUnique({ where: { key: body.data.role }, select: { id: true } }))) {
    return apiError("Choose an existing role.", 400);
  }
  const passwordHash = await hashPassword(body.data.password);
  const id = randomUUID().replaceAll("-", "");
  try {
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id, name: body.data.name, email: body.data.email, phone: body.data.phone, emailVerified: true, role: body.data.role,
          accounts: { create: { id: randomUUID().replaceAll("-", ""), accountId: id, providerId: "credential", password: passwordHash } },
        },
        select: userSelect,
      });
      await writeAuditEvent(request, access.session.user.id, "CREATE", "User", created.id, { email: created.email, role: created.role }, tx);
      return created;
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return apiError("An account with this e-mail already exists.", 409);
    throw error;
  }
}
