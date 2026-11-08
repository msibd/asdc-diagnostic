import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { expenseVoidSchema } from "@/modules/expenses/expense-schema";

// Expenses are never deleted; voiding keeps the entry (and why it was voided) for the record.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "expenses:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, expenseVoidSchema, "A reason is required.");
  if (!body.ok) return body.response;
  const { id } = await params;

  const result = await prisma.$transaction(async (transaction) => {
    const expense = await transaction.expense.findUnique({ where: { id }, select: { id: true, voidedAt: true } });
    if (!expense) return { error: "Expense not found.", status: 404 as const };
    if (expense.voidedAt) return { error: "This expense is already voided.", status: 409 as const };
    await transaction.expense.update({ where: { id }, data: { voidedAt: new Date(), voidReason: body.data.reason } });
    await writeAuditEvent(request, access.session.user.id, "VOID", "Expense", id, { reason: body.data.reason }, transaction);
    return { error: null, status: 200 as const };
  });
  if (result.error) return apiError(result.error, result.status);
  return NextResponse.json({ success: true });
}
