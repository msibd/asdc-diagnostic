import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { addClinicDays, formatClinicWeekday, getClinicDateKey } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";

function dhakaMidnightUtc(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+06:00`);
}

export async function GET(request: Request) {
  const access = await authorize(request.headers, "dashboard:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const canSeeMoney = access.permissions.includes("billing:read");
  const now = new Date();
  const todayKey = getClinicDateKey(now);
  const tomorrowKey = addClinicDays(todayKey, 1);
  const todayStart = dhakaMidnightUtc(todayKey);
  const tomorrowStart = dhakaMidnightUtc(tomorrowKey);
  const monthStart = dhakaMidnightUtc(`${todayKey.slice(0, 7)}-01`);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(formatClinicWeekday(todayKey));
  const weekStart = dhakaMidnightUtc(addClinicDays(todayKey, -weekday));
  const year = Number(todayKey.slice(0, 4));
  const month0 = Number(todayKey.slice(5, 7)) - 1;
  const firstOfMonth = (offset: number) => dhakaMidnightUtc(
    `${new Date(Date.UTC(year, month0 + offset, 1, 12)).toISOString().slice(0, 7)}-01`,
  );
  const nextMonthStart = firstOfMonth(1);
  const sixMonthsStart = firstOfMonth(-5);
  const sixYearsStart = dhakaMidnightUtc(`${year - 5}-01-01`);
  const nextYearStart = dhakaMidnightUtc(`${year + 1}-01-01`);

  // Independent aggregates run in parallel on the pool instead of 14 sequential round trips.
  const [
    totalPatients,
    activeDoctor,
    [appointmentTotals],
    [paymentTotals],
    invoiceTotals,
    weeklySchedule,
    topServices,
    monthlyRows,
    yearlyRows,
    nextAppointment,
    pendingRequests,
    todaySchedule,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.doctorProfile.count({ where: { id: "primary" } }),
    prisma.$queryRaw<{
      today: number;
      pending: number;
      completed: number;
      total: number;
      direct: number;
      whatsapp: number;
      confirmed: number;
      completedAll: number;
      month: number;
    }[]>`
      SELECT
        COUNT(*) FILTER (WHERE "dateTime" >= ${todayStart} AND "dateTime" < ${tomorrowStart} AND status NOT IN ('CANCELLED', 'NO_SHOW'))::int AS today,
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending,
        COUNT(*) FILTER (WHERE "dateTime" >= ${monthStart} AND "dateTime" < ${tomorrowStart} AND status = 'COMPLETED')::int AS completed,
        COUNT(*) FILTER (WHERE status NOT IN ('CANCELLED', 'NO_SHOW'))::int AS total,
        COUNT(*) FILTER (WHERE source = 'DIRECT')::int AS direct,
        COUNT(*) FILTER (WHERE source = 'WHATSAPP')::int AS whatsapp,
        COUNT(*) FILTER (WHERE status = 'CONFIRMED')::int AS confirmed,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS "completedAll",
        COUNT(*) FILTER (WHERE "dateTime" >= ${monthStart} AND "dateTime" < ${nextMonthStart} AND status NOT IN ('CANCELLED', 'NO_SHOW'))::int AS month
      FROM "Appointment"
    `,
    prisma.$queryRaw<{ today: string; week: string; month: string; posted: string }[]>`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE "receivedAt" >= ${todayStart} AND "receivedAt" < ${tomorrowStart}), 0)::text AS today,
        COALESCE(SUM(amount) FILTER (WHERE "receivedAt" >= ${weekStart} AND "receivedAt" < ${tomorrowStart}), 0)::text AS week,
        COALESCE(SUM(amount) FILTER (WHERE "receivedAt" >= ${monthStart} AND "receivedAt" < ${tomorrowStart}), 0)::text AS month,
        COALESCE(SUM(amount), 0)::text AS posted
      FROM "Payment"
      WHERE status = 'POSTED'
    `,
    prisma.invoice.aggregate({ where: { status: { not: "VOID" } }, _sum: { subtotal: true, discount: true, tax: true } }),
    prisma.$queryRaw<{ date: string; count: number; completed: number }[]>`
      SELECT
        TO_CHAR(("dateTime" + INTERVAL '6 hours')::date, 'YYYY-MM-DD') AS date,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed
      FROM "Appointment"
      WHERE "dateTime" >= ${weekStart}
        AND "dateTime" < ${tomorrowStart}
        AND status NOT IN ('CANCELLED', 'NO_SHOW')
      GROUP BY ("dateTime" + INTERVAL '6 hours')::date
    `,
    prisma.$queryRaw<{ name: string; count: number }[]>`
      SELECT service AS name, COUNT(*)::int AS count
      FROM "Appointment"
      WHERE status NOT IN ('CANCELLED', 'NO_SHOW')
      GROUP BY service
      ORDER BY count DESC, service ASC
      LIMIT 4
    `,
    prisma.$queryRaw<{ key: string; count: number; completed: number }[]>`
      SELECT
        TO_CHAR(("dateTime" + INTERVAL '6 hours'), 'YYYY-MM') AS key,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed
      FROM "Appointment"
      WHERE "dateTime" >= ${sixMonthsStart} AND "dateTime" < ${nextMonthStart} AND status NOT IN ('CANCELLED', 'NO_SHOW')
      GROUP BY 1
    `,
    prisma.$queryRaw<{ key: string; count: number; completed: number }[]>`
      SELECT
        TO_CHAR(("dateTime" + INTERVAL '6 hours'), 'YYYY') AS key,
        COUNT(*)::int AS count,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed
      FROM "Appointment"
      WHERE "dateTime" >= ${sixYearsStart} AND "dateTime" < ${nextYearStart} AND status NOT IN ('CANCELLED', 'NO_SHOW')
      GROUP BY 1
    `,
    prisma.appointment.findFirst({
      where: { status: { notIn: ["CANCELLED", "NO_SHOW"] }, dateTime: { gte: now } },
      orderBy: [{ dateTime: "asc" }, { id: "asc" }],
    }),
    prisma.appointment.findMany({
      where: { status: "PENDING" },
      orderBy: [{ dateTime: "desc" }, { id: "desc" }],
      take: 3,
    }),
    prisma.appointment.findMany({
      where: { dateTime: { gte: todayStart, lt: tomorrowStart }, status: { notIn: ["CANCELLED", "NO_SHOW"] } },
      orderBy: [{ dateTime: "asc" }, { id: "asc" }],
      take: 4,
    }),
  ]);
  const todayAppointments = appointmentTotals.today;
  const pendingAppointments = appointmentTotals.pending;
  const completedThisMonth = appointmentTotals.completed;
  const totalAppointments = appointmentTotals.total;
  const directAppointments = appointmentTotals.direct;
  const whatsappAppointments = appointmentTotals.whatsapp;
  const dailyRevenue = { _sum: { amount: paymentTotals.today } };
  const weeklyRevenue = { _sum: { amount: paymentTotals.week } };
  const monthlyRevenue = { _sum: { amount: paymentTotals.month } };
  const payments = { _sum: { amount: paymentTotals.posted } };
  const weeklyCounts = new Map(weeklySchedule.map((day) => [day.date, day]));
  const weeklyAppointments = Array.from({ length: 7 }, (_, index) => {
    const date = addClinicDays(addClinicDays(todayKey, -weekday), index);
    const counts = weeklyCounts.get(date);
    return {
      date,
      count: counts?.count ?? 0,
      completed: counts?.completed ?? 0,
    };
  });
  const grossDue = Number(invoiceTotals._sum.subtotal ?? 0)
    - Number(invoiceTotals._sum.discount ?? 0)
    + Number(invoiceTotals._sum.tax ?? 0);
  const outstanding = Math.max(0, grossDue - Number(payments._sum.amount ?? 0));
  return NextResponse.json({
    totalPatients,
    todayAppointments,
    pendingAppointments,
    completedThisMonth,
    totalAppointments,
    sourceCounts: { direct: directAppointments, whatsapp: whatsappAppointments },
    doctorCount: activeDoctor,
    // Money figures only for roles that may see billing; everyone else gets the appointment figures alone.
    ...(canSeeMoney ? {
      revenue: {
        today: Number(dailyRevenue._sum.amount ?? 0).toFixed(2),
        week: Number(weeklyRevenue._sum.amount ?? 0).toFixed(2),
        month: Number(monthlyRevenue._sum.amount ?? 0).toFixed(2),
      },
      outstanding: outstanding.toFixed(2),
    } : {}),
    weeklyAppointments,
    // Whole-clinic figures for the overview cards, so they do not depend on the loaded appointment page.
    overview: {
      confirmedCount: appointmentTotals.confirmed,
      completedCount: appointmentTotals.completedAll,
      monthAppointments: appointmentTotals.month,
      topServices,
      monthly: monthlyRows,
      yearly: yearlyRows,
      nextAppointment,
      pendingRequests,
      todaySchedule,
    },
  });
}
