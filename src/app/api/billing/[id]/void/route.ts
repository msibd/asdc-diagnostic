import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";

const voidSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "billing:void");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = voidSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "A void reason is required." }, { status: 400 });
  const { id } = await params;
  const result = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(41680271)`;
    const invoice = await transaction.invoice.findUnique({ where: { id }, include: { payments: true } });
    if (!invoice) return { error: "Invoice not found.", status: 404 as const };
    if (invoice.status === "VOID") return { error: "Invoice is already void.", status: 409 as const };
    if (invoice.payments.length) return { error: "An invoice with payment activity cannot be voided. Refund its posted payments individually first.", status: 409 as const };
    const updated = await transaction.invoice.update({
      where: { id },
      data: { status: "VOID", notes: `${invoice.notes ? `${invoice.notes}\n` : ""}Voided: ${parsed.data.reason}` },
    });
    await writeAuditEvent(request, access.session.user.id, "VOID", "Invoice", id, { reason: parsed.data.reason }, transaction);
    return { invoice: updated };
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ success: true });
}
