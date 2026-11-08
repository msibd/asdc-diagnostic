import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody, parseQuery } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { addClinicDays, getClinicDateKey } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";
import { expenseInputSchema, expenseListQuerySchema } from "@/modules/expenses/expense-schema";

const PAGE_SIZE = 100;
const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);

const expenseSelect = {
  id: true,
  category: true,
  description: true,
  amount: true,
  spentAt: true,
  method: true,
  reference: true,
  voidedAt: true,
  voidReason: true,
  createdBy: { select: { id: true, name: true } },
} as const;

export async function GET(request: Request) {
  const access = await authorize(request.headers, "expenses:read");
  if (!access.session) return apiError(access.error, access.status);
  const query = parseQuery(request, expenseListQuerySchema);
  if (!query.ok) return query.response;

  // Default to the current month (clinic time).
  const today = getClinicDateKey(new Date());
  const from = query.data.from ?? `${today.slice(0, 7)}-01`;
  const to = query.data.to ?? today;
  if (from > to) return apiError("The start date must be on or before the end date.", 400);

  const where = {
    spentAt: { gte: dateOnly(from), lte: dateOnly(to) },
    ...(query.data.category ? { category: query.data.category } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      select: expenseSelect,
      orderBy: [{ spentAt: "desc" }, { id: "desc" }],
      ...(query.data.cursor ? { cursor: { id: query.data.cursor }, skip: 1 } : {}),
      take: PAGE_SIZE + 1,
    }),
    // Voided expenses stay listed for the record but never count toward the total.
    prisma.expense.aggregate({ where: { ...where, voidedAt: null }, _sum: { amount: true } }),
  ]);
  const hasMore = rows.length > PAGE_SIZE;
  const expenses = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  return NextResponse.json({
    range: { from, to },
    total: Number(total._sum.amount ?? 0).toFixed(2),
    expenses: expenses.map((expense) => ({ ...expense, amount: expense.amount.toString() })),
    nextCursor: hasMore ? expenses.at(-1)?.id ?? null : null,
  });
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "expenses:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, expenseInputSchema, "Invalid expense.");
  if (!body.ok) return body.response;

  // An expense cannot be dated in the future (a day of slack covers clock/time-zone differences).
  if (body.data.spentAt > addClinicDays(getClinicDateKey(new Date()), 1)) {
    return apiError("An expense cannot be dated in the future.", 400);
  }

  const expense = await prisma.$transaction(async (transaction) => {
    const created = await transaction.expense.create({
      data: {
        category: body.data.category,
        description: body.data.description,
        amount: Math.round(body.data.amount * 100) / 100,
        spentAt: dateOnly(body.data.spentAt),
        method: body.data.method,
        reference: body.data.reference,
        createdById: access.session.user.id,
      },
      select: expenseSelect,
    });
    await writeAuditEvent(request, access.session.user.id, "CREATE", "Expense", created.id, {
      category: created.category,
      amount: created.amount.toString(),
    }, transaction);
    return created;
  });
  return NextResponse.json({ expense: { ...expense, amount: expense.amount.toString() } }, { status: 201 });
}
