import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { addClinicDays } from "@/lib/clinic-date";

const paramsSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
});

export async function GET(request: Request) {
  const access = await authorize(request.headers, "reports:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const search = new URL(request.url).searchParams;
  const parsed = paramsSchema.safeParse({ from: search.get("from"), to: search.get("to") });
  if (!parsed.success) return NextResponse.json({ error: "Valid from and to dates are required." }, { status: 400 });
  if (parsed.data.from > parsed.data.to) {
    return NextResponse.json({ error: "The start date must be on or before the end date." }, { status: 400 });
  }
  const from = new Date(`${parsed.data.from}T00:00:00+06:00`);
  const to = new Date(`${addClinicDays(parsed.data.to, 1)}T00:00:00+06:00`);
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ error: "Date range must be ordered and no longer than 366 days." }, { status: 400 });
  }

  const [
    appointmentGroups,
    dailyAppointments,
    patients,
    orderGroups,
    postedPayments,
    dailyRevenue,
    outstandingRows,
  ] = await prisma.$transaction([
    prisma.appointment.groupBy({
      by: ["status"],
      orderBy: { status: "asc" },
      where: { dateTime: { gte: from, lt: to } },
      _count: true,
    }),
    prisma.$queryRaw<{ date: string; count: number }[]>`
      SELECT
        TO_CHAR(("dateTime" + INTERVAL '6 hours')::date, 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count
      FROM "Appointment"
      WHERE "dateTime" >= ${from} AND "dateTime" < ${to}
      GROUP BY ("dateTime" + INTERVAL '6 hours')::date
      ORDER BY ("dateTime" + INTERVAL '6 hours')::date
    `,
    prisma.patient.count({ where: { createdAt: { gte: from, lt: to } } }),
    // Lab orders placed in the period, by where they stand now.
    prisma.testOrder.groupBy({
      by: ["status"],
      orderBy: { status: "asc" },
      where: { orderedAt: { gte: from, lt: to } },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: { receivedAt: { gte: from, lt: to }, status: "POSTED" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ date: string; amount: string }[]>`
      SELECT
        TO_CHAR(("receivedAt" + INTERVAL '6 hours')::date, 'YYYY-MM-DD') AS date,
        SUM(amount)::text AS amount
      FROM "Payment"
      WHERE "receivedAt" >= ${from}
        AND "receivedAt" < ${to}
        AND status = 'POSTED'
      GROUP BY ("receivedAt" + INTERVAL '6 hours')::date
      ORDER BY ("receivedAt" + INTERVAL '6 hours')::date
    `,
    prisma.$queryRaw<{ outstanding: string }[]>`
      SELECT COALESCE(SUM(GREATEST(
        0,
        invoice.subtotal - invoice.discount + invoice.tax - COALESCE(payment.total, 0)
      )), 0)::text AS outstanding
      FROM "Invoice" AS invoice
      LEFT JOIN (
        SELECT "invoiceId", SUM(amount) AS total
        FROM "Payment"
        WHERE status = 'POSTED'
        GROUP BY "invoiceId"
      ) AS payment ON payment."invoiceId" = invoice.id
      WHERE invoice."issuedAt" >= ${from}
        AND invoice."issuedAt" < ${to}
        AND invoice.status <> 'VOID'
    `,
  ]);
  const [revenueByMethod, expensesByCategory, noShowPatients] = await Promise.all([
    prisma.payment.groupBy({
      by: ["method"],
      orderBy: { method: "asc" },
      where: { receivedAt: { gte: from, lt: to }, status: "POSTED" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    // Expense dates are plain calendar dates; voided expenses are excluded.
    prisma.expense.groupBy({
      by: ["category"],
      orderBy: { category: "asc" },
      where: {
        spentAt: { gte: new Date(`${parsed.data.from}T00:00:00.000Z`), lte: new Date(`${parsed.data.to}T00:00:00.000Z`) },
        voidedAt: null,
      },
      _sum: { amount: true },
    }),
    // Patients who missed appointments in the period, most missed first.
    prisma.$queryRaw<{ name: string; phone: string; count: number }[]>`
      SELECT "patientName" AS name, "patientPhone" AS phone, COUNT(*)::int AS count
      FROM "Appointment"
      WHERE status = 'NO_SHOW' AND "dateTime" >= ${from} AND "dateTime" < ${to}
      GROUP BY "patientName", "patientPhone"
      ORDER BY count DESC, name
      LIMIT 10
    `,
  ]);
  const appointmentStatuses = Object.fromEntries(
    ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map((status) => [
      status,
      appointmentGroups.find((group) => group.status === status)?._count ?? 0,
    ]),
  );
  const revenue = Number(postedPayments._sum.amount ?? 0);
  const outstanding = Number(outstandingRows[0]?.outstanding ?? 0);
  const expenseTotalCents = expensesByCategory.reduce((sum, row) => sum + Math.round(Number(row._sum.amount ?? 0) * 100), 0);
  const revenueCents = Math.round(revenue * 100);

  return NextResponse.json({
    range: parsed.data,
    patientRegistrations: patients,
    appointments: {
      total: appointmentGroups.reduce((total, group) => {
        const count = typeof group._count === "number"
          ? group._count
          : typeof group._count === "object" && group._count !== null
            ? group._count._all ?? 0
            : 0;
        return total + count;
      }, 0),
      byStatus: appointmentStatuses,
    },
    noShows: {
      count: Number(appointmentStatuses.NO_SHOW ?? 0),
      // Share of appointments that were due (completed or missed), so cancelled and still-open ones do not skew it.
      ratePercent: (() => {
        const missed = Number(appointmentStatuses.NO_SHOW ?? 0);
        const due = missed + Number(appointmentStatuses.COMPLETED ?? 0);
        return due ? Math.round((missed / due) * 1000) / 10 : 0;
      })(),
      patients: noShowPatients,
    },
    orders: orderGroups.map((group) => ({ status: group.status, count: group._count })),
    revenue: revenue.toFixed(2),
    paymentTransactions: postedPayments._count._all,
    outstanding: outstanding.toFixed(2),
    dailyAppointments,
    dailyRevenue: dailyRevenue.map((day) => ({ date: day.date, amount: Number(day.amount).toFixed(2) })),
    revenueByMethod: revenueByMethod.map((row) => ({
      method: row.method,
      amount: Number(row._sum.amount ?? 0).toFixed(2),
      count: row._count._all,
    })),
    expenses: {
      total: (expenseTotalCents / 100).toFixed(2),
      byCategory: expensesByCategory.map((row) => ({ category: row.category, amount: Number(row._sum.amount ?? 0).toFixed(2) })),
    },
    // Cash collected minus recorded expenses for the period (a simple cash view, not accounting profit).
    netIncome: ((revenueCents - expenseTotalCents) / 100).toFixed(2),
  });
}
