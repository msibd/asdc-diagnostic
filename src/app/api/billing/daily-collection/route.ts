import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { apiError, parseQuery } from "@/lib/api";
import { addClinicDays, getClinicDateKey } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({ date: z.iso.date().optional() });

// End-of-day cash-up: what was collected on a clinic day, by payment method, and what was refunded.
export async function GET(request: Request) {
  const access = await authorize(request.headers, "billing:read");
  if (!access.session) return apiError(access.error, access.status);
  const query = parseQuery(request, querySchema);
  if (!query.ok) return query.response;

  const date = query.data.date ?? getClinicDateKey(new Date());
  const start = new Date(`${date}T00:00:00+06:00`);
  const end = new Date(`${addClinicDays(date, 1)}T00:00:00+06:00`);

  const [collected, refunded] = await Promise.all([
    prisma.payment.groupBy({
      by: ["method"],
      orderBy: { method: "asc" },
      where: { receivedAt: { gte: start, lt: end }, status: "POSTED" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.payment.aggregate({
      where: { refundedAt: { gte: start, lt: end }, status: "REFUNDED" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);

  const byMethod = collected.map((row) => ({
    method: row.method,
    amount: Number(row._sum.amount ?? 0).toFixed(2),
    count: row._count._all,
  }));
  const total = collected.reduce((sum, row) => sum + Math.round(Number(row._sum.amount ?? 0) * 100), 0);
  return NextResponse.json({
    date,
    total: (total / 100).toFixed(2),
    transactionCount: collected.reduce((sum, row) => sum + row._count._all, 0),
    byMethod,
    refunded: { amount: Number(refunded._sum.amount ?? 0).toFixed(2), count: refunded._count._all },
  });
}
