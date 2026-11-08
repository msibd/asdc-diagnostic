import { NextResponse } from "next/server";
import { hashPassword } from "better-auth/crypto";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { passwordResetSchema } from "@/modules/access/access-schema";

// Sets a new password for another staff member (a forgotten password) and signs them out.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "users:manage");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, passwordResetSchema, "Invalid password.");
  if (!body.ok) return body.response;
  const { id } = await params;
  if (id === access.session.user.id) return apiError("Change your own password from the Security page.", 400);
  const credential = await prisma.account.findFirst({ where: { userId: id, providerId: "credential" }, select: { id: true } });
  if (!credential) return apiError("This account has no password sign-in.", 404);
  const passwordHash = await hashPassword(body.data.password);
  await prisma.$transaction(async (tx) => {
    await tx.account.update({ where: { id: credential.id }, data: { password: passwordHash } });
    await tx.session.deleteMany({ where: { userId: id } });
    await writeAuditEvent(request, access.session.user.id, "RESET_PASSWORD", "User", id, undefined, tx);
  });
  return NextResponse.json({ success: true });
}
