"use client";

import { useEffect, useRef } from "react";

const COALESCE_MS = 400;

export default function useLiveRefresh(
  refresh: () => void | Promise<void>,
  enabled = true,
  fallbackIntervalMs = 30_000,
  // Database tables this view depends on. Events for other tables are ignored.
  // Omit to refresh on every change (previous behaviour).
  tables?: readonly string[],
) {
  const refreshRef = useRef(refresh);
  const tablesKey = tables?.join("|");

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;
    let timer: number | undefined;
    let refreshing = false;
    const source = new EventSource("/api/realtime");
    const runRefresh = async () => {
      if (refreshing) return;
      if (document.visibilityState !== "visible") return;
      refreshing = true;
      try {
        await refreshRef.current();
      } finally {
        refreshing = false;
      }
    };

    const refreshWhenVisible = () => {
      if (document.visibilityState !== "visible") return;
      void runRefresh();
    };
    const scheduleFallback = () => {
      if (!active) return;
      if (source?.readyState === EventSource.OPEN) {
        timer = window.setTimeout(scheduleFallback, fallbackIntervalMs);
        return;
      }
      void runRefresh().finally(() => {
        if (active) timer = window.setTimeout(scheduleFallback, fallbackIntervalMs);
      });
    };

    const watchedTables = tablesKey ? new Set(tablesKey.split("|")) : null;
    let coalesceTimer: number | undefined;
    const onClinicChange = (event: Event) => {
      if (watchedTables) {
        try {
          const change = JSON.parse((event as MessageEvent<string>).data) as { table?: string };
          if (change.table && !watchedTables.has(change.table)) return;
        } catch {
          // Malformed payload: refresh to stay correct.
        }
      }
      // A single write can emit several notifications (row table + audit log); refresh once.
      window.clearTimeout(coalesceTimer);
      coalesceTimer = window.setTimeout(refreshWhenVisible, COALESCE_MS);
    };

    source.addEventListener("clinic-change", onClinicChange);
    timer = window.setTimeout(scheduleFallback, fallbackIntervalMs);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      window.clearTimeout(coalesceTimer);
      source?.close();
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [enabled, fallbackIntervalMs, tablesKey]);
}
