import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getStaffSession(request.headers);
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  if (id === access.session.session.id) {
    return NextResponse.json({ error: "Use Sign out to end the current session." }, { status: 409 });
  }
  const result = await prisma.session.deleteMany({
    where: { id, userId: access.session.user.id },
  });
  if (!result.count) return NextResponse.json({ error: "Session not found." }, { status: 404 });
  await writeAuditEvent(request, access.session.user.id, "REVOKE_SESSION", "Session", id);
  return NextResponse.json({ success: true });
}
