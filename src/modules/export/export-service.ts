import { ExpenseCategory, StockMovementType, TestOrderStatus } from "@/generated/prisma/client";
import { addClinicDays, getClinicDateKey, formatClinicTime } from "@/lib/clinic-date";
import type { Permission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { EXPORT_PERMISSIONS, type ExportDataset } from "./export-config";
import { buildPatientWhere } from "@/modules/patients/queries/patient-queries";

// What can be exported: one entry per list. Each lists only the columns that are safe to hand out
// (patients are identified by their patient ID, never by medical, address or date-of-birth details)
// and reads rows in chunks, so a big list never sits in memory at once.

export const EXPORT_LIMITS = { csvRows: 50_000, printRows: 2_000, chunk: 1_000 } as const;

export type ExportFilters = { from?: string; to?: string; search: string; status: string; category: string; sort: string };
export type Cell = string | number;

export type ExportDefinition = {
  permission: Permission;
  title: string;
  /** Used in the file name, e.g. clinic-payments-2026-11-01_to_2026-11-08.csv */
  slug: string;
  headers: string[];
  /** Columns added up in the totals row of the printable report. */
  sumColumns?: number[];
  /** Values the status / category filter accepts. */
  statuses?: readonly string[];
  categories?: readonly string[];
  rows: (filters: ExportFilters) => AsyncGenerator<Cell[]>;
};

const money = (value: { toString(): string } | number | null) => Math.round(Number(value ?? 0) * 100) / 100;
const dateKey = (value: Date) => value.toISOString().slice(0, 10);
const stamp = (value: Date) => `${getClinicDateKey(value)} ${formatClinicTime(value)}`;

// Clinic days run on Dhaka time (UTC+6).
const dayStart = (day: string) => new Date(`${day}T00:00:00+06:00`);
const timeRange = ({ from, to }: ExportFilters) => (from || to ? { ...(from && { gte: dayStart(from) }), ...(to && { lt: dayStart(addClinicDays(to, 1)) }) } : undefined);
const dateRange = ({ from, to }: ExportFilters) => (from || to ? { ...(from && { gte: new Date(`${from}T00:00:00.000Z`) }), ...(to && { lte: new Date(`${to}T00:00:00.000Z`) }) } : undefined);

/** Reads a list in chunks with a cursor on the row id (stable even while rows are added). */
async function* chunked<T extends { id: string }>(read: (cursor: { id: string } | undefined, take: number) => Promise<T[]>) {
  let cursor: { id: string } | undefined;
  for (;;) {
    const batch = await read(cursor, EXPORT_LIMITS.chunk);
    yield* batch;
    if (batch.length < EXPORT_LIMITS.chunk) return;
    cursor = { id: batch[batch.length - 1].id };
  }
}
const page = (cursor: { id: string } | undefined, take: number) => ({ take, ...(cursor && { cursor, skip: 1 }) });

export const EXPORTS: Record<ExportDataset, ExportDefinition> = {
  patients: {
    permission: EXPORT_PERMISSIONS["patients"],
    title: "Patient list",
    slug: "patients",
    headers: ["Patient ID", "Name", "Phone", "Status", "Registered"],
    statuses: ["ALL", "ACTIVE", "INACTIVE"],
    async *rows(filters) {
      const where = buildPatientWhere({ search: filters.search, status: (filters.status || "ALL") as "ALL" | "ACTIVE" | "INACTIVE" });
      const orderBy = filters.sort === "name" ? [{ name: "asc" as const }, { id: "asc" as const }] : [{ createdAt: "desc" as const }, { id: "asc" as const }];
      for await (const patient of chunked((cursor, take) => prisma.patient.findMany({ where, orderBy, select: { id: true, patientCode: true, name: true, phone: true, isActive: true, createdAt: true }, ...page(cursor, take) }))) {
        yield [patient.patientCode, patient.name, patient.phone, patient.isActive ? "Active" : "Inactive", getClinicDateKey(patient.createdAt)];
      }
    },
  },

  orders: {
    permission: EXPORT_PERMISSIONS["orders"],
    title: "Test orders",
    slug: "test-orders",
    headers: ["Order", "Ordered", "Patient ID", "Status", "Priority", "Tests", "Invoice"],
    // "OPEN" is the screen's group for orders that are not finished (not cancelled, not delivered).
    statuses: [...Object.values(TestOrderStatus), "OPEN"],
    async *rows(filters) {
      const status = filters.status === "OPEN"
        ? { status: { notIn: [TestOrderStatus.CANCELLED, TestOrderStatus.DELIVERED] } }
        : filters.status ? { status: filters.status as TestOrderStatus } : {};
      const where = { orderedAt: timeRange(filters), ...status };
      for await (const order of chunked((cursor, take) => prisma.testOrder.findMany({
        where, orderBy: [{ orderedAt: "desc" }, { id: "asc" }],
        select: { id: true, orderCode: true, orderedAt: true, status: true, priority: true, patient: { select: { patientCode: true } }, invoice: { select: { invoiceCode: true } }, _count: { select: { items: true } } },
        ...page(cursor, take),
      }))) {
        yield [order.orderCode, stamp(order.orderedAt), order.patient.patientCode, order.status, order.priority, order._count.items, order.invoice?.invoiceCode ?? ""];
      }
    },
  },

  payments: {
    permission: EXPORT_PERMISSIONS["payments"],
    title: "Payments received",
    slug: "payments",
    headers: ["Received", "Invoice", "Patient ID", "Method", "Reference", "Amount (BDT)"],
    sumColumns: [5],
    async *rows(filters) {
      const where = { status: "POSTED" as const, receivedAt: timeRange(filters) };
      for await (const payment of chunked((cursor, take) => prisma.payment.findMany({
        where, orderBy: [{ receivedAt: "desc" }, { id: "asc" }],
        select: { id: true, receivedAt: true, method: true, reference: true, amount: true, invoice: { select: { invoiceCode: true, patient: { select: { patientCode: true } } } } },
        ...page(cursor, take),
      }))) {
        yield [stamp(payment.receivedAt), payment.invoice.invoiceCode, payment.invoice.patient.patientCode, payment.method, payment.reference ?? "", money(payment.amount)];
      }
    },
  },

  expenses: {
    permission: EXPORT_PERMISSIONS["expenses"],
    title: "Expenses",
    slug: "expenses",
    headers: ["Date", "Category", "Description", "Method", "Reference", "Amount (BDT)"],
    sumColumns: [5],
    categories: Object.values(ExpenseCategory),
    async *rows(filters) {
      const where = { voidedAt: null, spentAt: dateRange(filters), ...(filters.category && { category: filters.category as ExpenseCategory }) };
      for await (const expense of chunked((cursor, take) => prisma.expense.findMany({ where, orderBy: [{ spentAt: "desc" }, { id: "asc" }], ...page(cursor, take) }))) {
        yield [dateKey(expense.spentAt), expense.category, expense.description, expense.method, expense.reference ?? "", money(expense.amount)];
      }
    },
  },

  "cash-closings": {
    permission: EXPORT_PERMISSIONS["cash-closings"],
    title: "Daily cash closings",
    slug: "cash-closings",
    headers: ["Date", "Opening cash", "Cash received", "Cash refunded", "Cash expenses", "Expected cash", "Counted cash", "Difference"],
    async *rows(filters) {
      const where = { businessDate: dateRange(filters) };
      for await (const closing of chunked((cursor, take) => prisma.cashClosing.findMany({ where, orderBy: [{ businessDate: "desc" }, { id: "asc" }], ...page(cursor, take) }))) {
        yield [dateKey(closing.businessDate), money(closing.openingCash), money(closing.cashReceived), money(closing.cashRefunded), money(closing.cashExpenses), money(closing.expectedCash), money(closing.countedCash), money(closing.difference)];
      }
    },
  },

  "inventory-movements": {
    permission: EXPORT_PERMISSIONS["inventory-movements"],
    title: "Stock movements",
    slug: "stock-movements",
    headers: ["Date", "Item", "Type", "Quantity", "Unit cost (BDT)", "Reason"],
    statuses: Object.values(StockMovementType),
    async *rows(filters) {
      const where = { createdAt: timeRange(filters), ...(filters.status && { type: filters.status as StockMovementType }) };
      for await (const movement of chunked((cursor, take) => prisma.stockMovement.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], include: { item: { select: { name: true, unit: true } } }, ...page(cursor, take) }))) {
        yield [stamp(movement.createdAt), movement.item.name, movement.type, movement.quantity, movement.unitCost === null ? "" : money(movement.unitCost), movement.reason ?? ""];
      }
    },
  },

  // Who did what and when. The details and the address of the device are left out: they can hold patient data.
  "audit-log": {
    permission: EXPORT_PERMISSIONS["audit-log"],
    title: "Activity log",
    slug: "activity-log",
    headers: ["Time", "Staff", "Action", "Record type"],
    async *rows(filters) {
      const where = { createdAt: timeRange(filters) };
      for await (const event of chunked((cursor, take) => prisma.auditEvent.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, createdAt: true, action: true, entity: true, actor: { select: { name: true } } }, ...page(cursor, take) }))) {
        yield [stamp(event.createdAt), event.actor?.name ?? "System", event.action, event.entity];
      }
    },
  },
};

export function exportFileName(definition: ExportDefinition, filters: ExportFilters, extension: string) {
  const range = filters.from || filters.to ? `${filters.from ?? "start"}_to_${filters.to ?? getClinicDateKey(new Date())}` : getClinicDateKey(new Date());
  return `clinic-${definition.slug}-${range}.${extension}`;
}
