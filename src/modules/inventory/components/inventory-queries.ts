"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryMeta } from "@/components/shared/query-provider";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import type { InventoryOverview, InventoryReport, MovementRow, PurchaseRow, SupplierRow } from "./inventory-types";

// Server data for the inventory screens, cached and shared between the tabs: switching from
// Stock to Purchases reuses the items and suppliers already loaded. Every key starts with
// "inventory", so one invalidation after a change refreshes all of them.

const TABLES: QueryMeta = { tables: ["InventoryItem", "StockBatch", "StockMovement", "StockPurchase", "Supplier"] };

export const inventoryKeys = {
  all: ["inventory"] as const,
  items: (includeInactive: boolean) => ["inventory", "items", { includeInactive }] as const,
  suppliers: ["inventory", "suppliers"] as const,
  purchases: (from: string, to: string) => ["inventory", "purchases", { from, to }] as const,
  movements: (query: string) => ["inventory", "movements", query] as const,
  report: (from: string, to: string) => ["inventory", "report", { from, to }] as const,
};

const getJson = async <T,>(url: string, signal?: AbortSignal) => requestJson<T>(await fetch(url, { cache: "no-store", signal }));

export function useInventoryItems(includeInactive = false) {
  return useQuery({
    queryKey: inventoryKeys.items(includeInactive),
    queryFn: ({ signal }) => getJson<InventoryOverview>(`/api/inventory/items?includeInactive=${includeInactive}`, signal),
    meta: TABLES,
  });
}

export function useSuppliers() {
  return useQuery({
    queryKey: inventoryKeys.suppliers,
    queryFn: ({ signal }) => getJson<{ suppliers: SupplierRow[] }>("/api/inventory/suppliers", signal),
    select: (result) => result.suppliers,
    meta: TABLES,
  });
}

type Page<K extends string, T> = { [key in K]: T[] } & { nextCursor: string | null };

/** Purchases in a date range, a page at a time ("Load more"). */
export function usePurchases(from: string, to: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: inventoryKeys.purchases(from, to),
    queryFn: ({ pageParam, signal }) => getJson<Page<"purchases", PurchaseRow> & { total: string }>(
      `/api/inventory/purchases?from=${from}&to=${to}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`, signal,
    ),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
    meta: TABLES,
  });
}

/** Stock changes matching a query string, a page at a time. */
export function useMovements(query: string, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: inventoryKeys.movements(query),
    queryFn: ({ pageParam, signal }) => getJson<Page<"movements", MovementRow>>(
      `/api/inventory/movements?${query}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`, signal,
    ),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
    meta: TABLES,
  });
}

export function useInventoryReport(from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: inventoryKeys.report(from, to),
    queryFn: ({ signal }) => getJson<InventoryReport>(`/api/inventory/reports?from=${from}&to=${to}`, signal),
    enabled,
    meta: TABLES,
  });
}

/** Any change to stock, items, purchases or suppliers; refreshes every inventory view afterwards. */
export function useInventoryMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ url, method, body }: { url: string; method: "POST" | "PATCH"; body: unknown }) =>
      requestJson(await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inventoryKeys.all }),
  });
}
