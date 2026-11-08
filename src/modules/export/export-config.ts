import type { Permission } from "@/lib/permissions";

// The part of the export feature the screens and the server both need. It imports nothing from the
// database, so a client component can use it.

export const EXPORT_DATASETS = ["patients", "orders", "payments", "expenses", "cash-closings", "inventory-movements", "audit-log"] as const;
export type ExportDataset = (typeof EXPORT_DATASETS)[number];
export const isExportDataset = (value: string): value is ExportDataset => (EXPORT_DATASETS as readonly string[]).includes(value);

/** The permission that lets someone export each list. */
export const EXPORT_PERMISSIONS: Record<ExportDataset, Permission> = {
  patients: "patients:export",
  orders: "orders:read",
  payments: "billing:read",
  expenses: "expenses:read",
  "cash-closings": "expenses:read",
  "inventory-movements": "inventory:read",
  "audit-log": "security:manage",
};
