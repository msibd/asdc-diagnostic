"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import useLiveRefresh from "@/hooks/use-live-refresh";
import { addClinicDays, getClinicDateKey } from "@/lib/clinic-date";
import type { PrintableInvoice } from "@/modules/clinic/components/print-sheets";

export type ClinicSection = "doctors" | "services" | "billing" | "reports" | "security" | "expenses" | "inventory" | "finance" | "access" | "email" | "sms" | "orders";
export type SectionProps = { onNotice: (message: string, error: boolean) => void };

// Database tables each section depends on; live updates for other tables are ignored.
export const liveTables = {
  doctors: ["DoctorProfile", "DoctorSchedule"],
  services: ["ClinicService"],
  orders: ["TestOrder", "TestOrderItem", "Sample", "Invoice", "Payment", "Patient"],
  billing: ["Invoice", "InvoiceItem", "Payment", "Patient", "ClinicService"],
  reports: ["Appointment", "Patient", "TreatmentPlan", "Payment", "Invoice"],
  security: ["AuditEvent", "session"],
  expenses: ["Expense"],
  inventory: ["InventoryItem", "StockBatch", "StockMovement", "StockPurchase", "Supplier"],
  finance: ["Payment", "Expense", "CashClosing"],
  access: ["user", "Role", "session"],
  email: ["EmailConfiguration", "EmailAuditLog"],
  sms: ["SmsConfiguration", "SmsLog"],
} as const;

const SEARCH_DEBOUNCE_MS = 250;

export function localDate(daysAgo = 0) {
  return addClinicDays(getClinicDateKey(new Date()), -daysAgo);
}

export function useDebouncedValue(value: string) {
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [value]);
  return debounced;
}

/**
 * Loads a section's data on mount and whenever `load` changes or `reload()` is called, and keeps it
 * fresh through live updates. `load` receives `needChoices`: dropdown choices (patients, services) are
 * only refetched when the data generation changes, not on every search keystroke or live refresh.
 */
export function useSectionLoader({
  section,
  load,
  shouldPauseLive,
  softReload = false,
}: {
  section: ClinicSection;
  load: (needChoices: boolean) => Promise<void>;
  shouldPauseLive?: () => boolean;
  /** After the first load, keep showing the current content while refreshing (filters, reloads). */
  softReload?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const choicesLoadedFor = useRef("");
  const loadedOnce = useRef(false);

  const run = useCallback(async (background = false, choicesKey?: string) => {
    const needChoices = !choicesKey || choicesLoadedFor.current !== choicesKey;
    if (!background && !(softReload && loadedOnce.current)) setLoading(true);
    setError("");
    try {
      await load(needChoices);
      loadedOnce.current = true;
      if (choicesKey) choicesLoadedFor.current = choicesKey;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load this module.");
    } finally {
      setLoading(false);
    }
  }, [load, softReload]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void run(false, `${section}:${refresh}`); }, 0);
    return () => window.clearTimeout(timer);
  }, [run, refresh, section]);

  useLiveRefresh(() => {
    if (shouldPauseLive?.()) return;
    void run(true);
  }, true, 30_000, liveTables[section]);

  const reload = useCallback(() => setRefresh((value) => value + 1), []);

  // Shared loading / error states; null once the section has data to show.
  const gate: ReactNode = loading
    ? <div className="loading-state" role="status">Loading {section} data…</div>
    : error
      ? <section className="panel-card patient-load-error" role="alert">{error}<button className="button-secondary" onClick={reload}><RefreshCw size={14} /> Retry</button></section>
      : null;

  return { gate, reload };
}

export type PrintJob =
  | { kind: "invoice"; invoice: PrintableInvoice }
  | null;

// Mount a print-only document, open the print dialog, and remove it afterwards so the page
// prints normally again.
export function usePrintJob() {
  const [printJob, setPrintJob] = useState<PrintJob>(null);
  useEffect(() => {
    if (!printJob) return;
    const clear = () => setPrintJob(null);
    window.addEventListener("afterprint", clear, { once: true });
    const frame = window.requestAnimationFrame(() => window.print());
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("afterprint", clear);
    };
  }, [printJob]);
  return [printJob, setPrintJob] as const;
}

export function Metric({ label, value }: { label: string; value: string | number }) {
  return <article className="clinic-report-metric"><span>{label}</span><strong>{value}</strong></article>;
}
