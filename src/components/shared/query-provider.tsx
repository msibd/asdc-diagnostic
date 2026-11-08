"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

/** Database tables a query depends on; the realtime stream refreshes it when one of them changes. */
export type QueryMeta = { tables?: readonly string[] };

const COALESCE_MS = 400;

/**
 * Refreshes cached queries when the database changes. The server already pushes a "clinic-change"
 * event per changed table (/api/realtime); every query that lists that table in `meta.tables` is
 * marked stale, and the ones on screen refetch. One connection for the whole dashboard.
 */
function RealtimeQuerySync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const source = new EventSource("/api/realtime");
    const pending = new Set<string>();
    let timer: number | undefined;
    const flush = () => {
      const tables = new Set(pending);
      pending.clear();
      void queryClient.invalidateQueries({
        predicate: (query) => ((query.meta as QueryMeta | undefined)?.tables ?? []).some((table) => tables.has(table)),
      });
    };
    const onChange = (event: Event) => {
      try {
        const change = JSON.parse((event as MessageEvent<string>).data) as { table?: string };
        if (!change.table) return;
        pending.add(change.table);
      } catch {
        return;
      }
      // One save can notify several tables (the row and the audit log): refresh once.
      window.clearTimeout(timer);
      timer = window.setTimeout(flush, COALESCE_MS);
    };
    source.addEventListener("clinic-change", onChange);
    return () => {
      window.clearTimeout(timer);
      source.close();
    };
  }, [queryClient]);
  return null;
}

/**
 * TanStack Query for the dashboard: cached server data shared between screens, background
 * refresh on focus and on realtime changes, and mutations that refresh what they affect.
 */
export default function QueryProvider({ children }: { children: ReactNode }) {
  // One client per browser session (useState keeps it across re-renders, never shared between users on the server).
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: 1,
      },
      mutations: { retry: 0 },
    },
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeQuerySync />
      {children}
    </QueryClientProvider>
  );
}
