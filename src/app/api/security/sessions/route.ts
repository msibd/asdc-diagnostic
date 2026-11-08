import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const access = await getStaffSession(request.headers);
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const sessions = await prisma.session.findMany({
    where: { userId: access.session.user.id },
    select: { id: true, createdAt: true, updatedAt: true, expiresAt: true, ipAddress: true, userAgent: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ sessions, currentSessionId: access.session.session.id });
}
