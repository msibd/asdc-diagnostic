import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { apiError, isPrismaError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { getClinicDateKey } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";
import { dailyFigures } from "@/modules/finance/finance-service";

const closingSchema = z.object({
  businessDate: z.iso.date(),
  countedCash: z.number().finite().min(0, "The counted cash cannot be negative.").max(99999999)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, "Use at most two decimal places."),
  note: z.string().trim().max(500).nullish().transform((value) => value || null),
});

export async function GET(request: Request) {
  const access = await authorize(request.headers, "expenses:read");
  if (!access.session) return apiError(access.error, access.status);
  const rows = await prisma.cashClosing.findMany({
    orderBy: { businessDate: "desc" },
    take: 60,
    include: { closedBy: { select: { name: true } } },
  });
  return NextResponse.json({
    closings: rows.map((row) => ({
      id: row.id,
      businessDate: row.businessDate.toISOString().slice(0, 10),
      openingCash: row.openingCash.toString(),
      cashReceived: row.cashReceived.toString(),
      cashRefunded: row.cashRefunded.toString(),
      cashExpenses: row.cashExpenses.toString(),
      expectedCash: row.expectedCash.toString(),
      countedCash: row.countedCash.toString(),
      difference: row.difference.toString(),
      note: row.note,
      closedAt: row.closedAt.toISOString(),
      closedBy: row.closedBy?.name ?? null,
    })),
  });
}

// Closes the cash book for one day. The expected cash is worked out on the server from the day's
// real payments and expenses, so the figures cannot be typed in. A day closes once.
export async function POST(request: Request) {
  const access = await authorize(request.headers, "finance:close");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, closingSchema, "Invalid cash closing.");
  if (!body.ok) return body.response;
  const { businessDate, countedCash, note } = body.data;
  if (businessDate > getClinicDateKey(new Date())) return apiError("A future day cannot be closed.", 400);

  const figures = await dailyFigures(businessDate);
  const toCents = (value: string) => Math.round(Number(value) * 100);
  const expected = toCents(figures.cash.expected);
  const counted = Math.round(countedCash * 100);
  const difference = counted - expected;
  if (difference !== 0 && !note) return apiError("The count does not match the expected cash. Add a note explaining the difference.", 400);

  try {
    const closing = await prisma.$transaction(async (tx) => {
      const created = await tx.cashClosing.create({
        data: {
          businessDate: new Date(`${businessDate}T00:00:00.000Z`),
          openingCash: figures.cash.opening,
          cashReceived: figures.cash.received,
          cashRefunded: figures.cash.refunded,
          cashExpenses: figures.cash.expenses,
          expectedCash: figures.cash.expected,
          countedCash: counted / 100,
          difference: difference / 100,
          note,
          closedById: access.session.user.id,
        },
      });
      await writeAuditEvent(request, access.session.user.id, "CLOSE", "CashClosing", created.id, {
        date: businessDate, expected: figures.cash.expected, counted: (counted / 100).toFixed(2), difference: (difference / 100).toFixed(2),
      }, tx);
      return created;
    });
    return NextResponse.json({ closing: { id: closing.id, difference: closing.difference.toString() } }, { status: 201 });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return apiError("This day is already closed.", 409);
    throw error;
  }
}
