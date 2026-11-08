import { addClinicDays } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";

const dateOnly = (value: string) => new Date(`${value}T00:00:00.000Z`);
const cents = (value: unknown) => Math.round(Number(value ?? 0) * 100);
const money = (valueCents: number) => (valueCents / 100).toFixed(2);

export type DailyFigures = {
  date: string;
  income: { method: string; received: string; refunded: string; net: string }[];
  expenses: { category: string; amount: string }[];
  expensesByMethod: { method: string; amount: string }[];
  totals: { received: string; refunded: string; income: string; expenses: string; net: string };
  cash: { opening: string; received: string; refunded: string; expenses: string; expected: string };
  previousClosing: { businessDate: string; countedCash: string } | null;
};

/**
 * Everything that happened in the cash book on one clinic day (Asia/Dhaka).
 *
 * Money is counted on the day it moved: a payment on the day it was received, a refund on the day it
 * was refunded, an expense on its own date. Only cash payments and cash expenses touch the drawer.
 */
export async function dailyFigures(date: string): Promise<DailyFigures> {
  const start = new Date(`${date}T00:00:00+06:00`);
  const end = new Date(`${addClinicDays(date, 1)}T00:00:00+06:00`);
  const [received, refunded, expenseRows, previous] = await Promise.all([
    prisma.payment.groupBy({ by: ["method"], orderBy: { method: "asc" }, where: { receivedAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    prisma.payment.groupBy({ by: ["method"], orderBy: { method: "asc" }, where: { refundedAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    prisma.expense.findMany({ where: { spentAt: dateOnly(date), voidedAt: null }, select: { category: true, method: true, amount: true } }),
    prisma.cashClosing.findFirst({ where: { businessDate: { lt: dateOnly(date) } }, orderBy: { businessDate: "desc" }, select: { businessDate: true, countedCash: true } }),
  ]);

  const methods = [...new Set([...received.map((row) => row.method), ...refunded.map((row) => row.method)])].sort();
  const income = methods.map((method) => {
    const gross = cents(received.find((row) => row.method === method)?._sum.amount);
    const back = cents(refunded.find((row) => row.method === method)?._sum.amount);
    return { method, received: money(gross), refunded: money(back), net: money(gross - back), grossCents: gross, backCents: back };
  });

  const byCategory = new Map<string, number>();
  const byMethod = new Map<string, number>();
  for (const row of expenseRows) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + cents(row.amount));
    byMethod.set(row.method, (byMethod.get(row.method) ?? 0) + cents(row.amount));
  }

  const receivedCents = income.reduce((sum, row) => sum + row.grossCents, 0);
  const refundedCents = income.reduce((sum, row) => sum + row.backCents, 0);
  const expensesCents = [...byCategory.values()].reduce((sum, value) => sum + value, 0);
  const cashRow = income.find((row) => row.method === "CASH");
  const cashReceived = cashRow?.grossCents ?? 0;
  const cashRefunded = cashRow?.backCents ?? 0;
  const cashExpenses = byMethod.get("CASH") ?? 0;
  const opening = cents(previous?.countedCash);

  return {
    date,
    income: income.map(({ method, received: gross, refunded: back, net }) => ({ method, received: gross, refunded: back, net })),
    expenses: [...byCategory].map(([category, amount]) => ({ category, amount: money(amount) })).sort((a, b) => a.category.localeCompare(b.category)),
    expensesByMethod: [...byMethod].map(([method, amount]) => ({ method, amount: money(amount) })).sort((a, b) => a.method.localeCompare(b.method)),
    totals: {
      received: money(receivedCents),
      refunded: money(refundedCents),
      income: money(receivedCents - refundedCents),
      expenses: money(expensesCents),
      net: money(receivedCents - refundedCents - expensesCents),
    },
    cash: {
      opening: money(opening),
      received: money(cashReceived),
      refunded: money(cashRefunded),
      expenses: money(cashExpenses),
      expected: money(opening + cashReceived - cashRefunded - cashExpenses),
    },
    previousClosing: previous ? { businessDate: previous.businessDate.toISOString().slice(0, 10), countedCash: previous.countedCash.toString() } : null,
  };
}
