import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { apiError, parseQuery } from "@/lib/api";
import { getClinicDateKey } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";
import { dailyFigures } from "@/modules/finance/finance-service";

const querySchema = z.object({ date: z.iso.date().optional() });

// The day's income, expenses and expected cash, plus the closing already recorded for that day.
export async function GET(request: Request) {
  const access = await authorize(request.headers, "expenses:read");
  if (!access.session) return apiError(access.error, access.status);
  const query = parseQuery(request, querySchema);
  if (!query.ok) return query.response;
  const today = getClinicDateKey(new Date());
  const date = query.data.date ?? today;
  if (date > today) return apiError("Choose today or an earlier date.", 400);
  const [figures, closing] = await Promise.all([
    dailyFigures(date),
    prisma.cashClosing.findUnique({
      where: { businessDate: new Date(`${date}T00:00:00.000Z`) },
      include: { closedBy: { select: { name: true } } },
    }),
  ]);
  return NextResponse.json({
    ...figures,
    closing: closing
      ? {
        id: closing.id,
        openingCash: closing.openingCash.toString(),
        expectedCash: closing.expectedCash.toString(),
        countedCash: closing.countedCash.toString(),
        difference: closing.difference.toString(),
        note: closing.note,
        closedAt: closing.closedAt.toISOString(),
        closedBy: closing.closedBy?.name ?? null,
      }
      : null,
  });
}
