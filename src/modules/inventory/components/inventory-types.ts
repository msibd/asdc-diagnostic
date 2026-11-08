import { formatDay } from "@/lib/clinic-date";

export type StockStatus = "OUT" | "LOW" | "OK";

export type StockBatchRow = {
  id: string;
  batchNumber: string | null;
  expiryDate: string | null;
  quantityRemaining: number;
  expiry: "EXPIRED" | "SOON" | "OK";
};

export type InventoryItemRow = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  unitCost: string;
  notes: string | null;
  isActive: boolean;
  supplier: { id: string; name: string } | null;
  status: StockStatus;
  expiredQuantity: number;
  expiringQuantity: number;
  nextExpiry: string | null;
  batches: StockBatchRow[];
};

export type InventoryOverview = {
  today: string;
  summary: { itemCount: number; low: number; out: number; expiring: number; expired: number; stockValue: string };
  items: InventoryItemRow[];
};

export type SupplierRow = {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  itemCount: number;
  purchaseCount: number;
  totalPurchased: string;
};

export type PurchaseRow = {
  id: string;
  purchaseCode: string;
  invoiceNumber: string | null;
  purchasedAt: string;
  totalCost: string;
  note: string | null;
  supplier: { id: string; name: string } | null;
  expense: { id: string; method: string; voidedAt: string | null } | null;
  batches: { id: string; quantityReceived: number; unitCost: string; batchNumber: string | null; expiryDate: string | null; item: { name: string; unit: string } }[];
};

export type MovementRow = {
  id: string;
  type: "PURCHASE" | "ISSUE" | "ADJUSTMENT";
  quantity: number;
  unitCost: string | null;
  reason: string | null;
  createdAt: string;
  item: { id: string; name: string; unit: string };
  batch: { batchNumber: string | null; expiryDate: string | null } | null;
  createdBy: { name: string } | null;
};

export type InventoryReport = {
  range: { from: string; to: string };
  purchases: { total: string; count: number; bySupplier: { supplier: string; total: string; count: number }[] };
  usage: { id: string; name: string; unit: string; quantity: number; cost: string }[];
  adjustments: { lostQuantity: number; lostValue: string; foundQuantity: number };
  stockValueByCategory: { category: string; items: number; value: string }[];
};

/** "7 Nov 2026" for a plain calendar day (purchase or expiry date). */
export const shortDate = formatDay;
