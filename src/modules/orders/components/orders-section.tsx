"use client";

import ExportButtons from "@/modules/export/components/export-buttons";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, ScanBarcode, Search } from "lucide-react";
import { useAdminSession } from "@/components/shared/admin-session-provider";
import { bdtCurrency as currency } from "@/lib/format";
import { formatClinicDate, formatClinicTime } from "@/lib/clinic-date";
import { can } from "@/lib/permissions";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import { useDebouncedValue, useSectionLoader, type SectionProps } from "@/modules/clinic/components/section-shared";
import NewOrderDialog from "./new-order-dialog";
import OrderDetailsDialog from "./order-details-dialog";
import { OrderSlipSheet, SampleLabelsSheet } from "./order-print";
import { resultsSummary, sampleSummary, STATUS_LABEL, type OrderRecord, type OrderStatus } from "./order-types";

const FILTERS: { value: string; label: string }[] = [
  { value: "OPEN", label: "Open" },
  { value: "ORDERED", label: "To collect" },
  { value: "SAMPLE_COLLECTED", label: "To receive" },
  { value: "RECEIVED", label: "In lab" },
  { value: "IN_PROCESS", label: "In process" },
  { value: "RESULT_ENTERED", label: "To approve" },
  { value: "ALL", label: "All" },
  { value: "CANCELLED", label: "Cancelled" },
];

type PrintJob = { kind: "labels" | "slip"; order: OrderRecord } | null;
type ScanEntry = { id: number; ok: boolean; text: string };

export default function OrdersSection({ onNotice }: SectionProps) {
  const { user } = useAdminSession();
  const canOrders = can(user.permissions, "orders:write");
  const canSamples = can(user.permissions, "samples:write");
  const canEnter = can(user.permissions, "results:enter");
  const canVerify = can(user.permissions, "results:verify");
  const canRelease = can(user.permissions, "results:release");
  const canSend = can(user.permissions, "reports:send");

  const [tab, setTab] = useState<"orders" | "receive">("orders");
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState("OPEN");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [printJob, setPrintJob] = useState<PrintJob>(null);

  const query = useCallback((cursor?: string | null) => {
    const params = new URLSearchParams({ status });
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (cursor) params.set("cursor", cursor);
    return `/api/orders?${params}`;
  }, [status, debouncedSearch]);

  const load = useCallback(async () => {
    const result = await requestJson<{ orders: OrderRecord[]; nextCursor: string | null }>(await fetch(query(), { cache: "no-store" }));
    setOrders(result.orders);
    setNextCursor(result.nextCursor);
  }, [query]);

  const { gate, reload } = useSectionLoader({ section: "orders", load, softReload: true, shouldPauseLive: () => creating || loadingMore });

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const result = await requestJson<{ orders: OrderRecord[]; nextCursor: string | null }>(await fetch(query(nextCursor), { cache: "no-store" }));
      setOrders((current) => [...current, ...result.orders.filter((order) => !current.some((existing) => existing.id === order.id))]);
      setNextCursor(result.nextCursor);
    } catch (moreError) {
      onNotice(moreError instanceof Error ? moreError.message : "Unable to load more orders.", true);
    } finally { setLoadingMore(false); }
  }

  // Open dialog always shows the freshest copy of the order (live refresh may replace the list under it).
  const open = openId ? orders.find((order) => order.id === openId) ?? null : null;
  const applyChange = useCallback((order: OrderRecord) => {
    setOrders((current) => current.some((existing) => existing.id === order.id) ? current.map((existing) => existing.id === order.id ? order : existing) : [order, ...current]);
  }, []);

  // Print: mount the sheet, open the browser's print dialog, then unmount it again.
  useEffect(() => {
    if (!printJob) return;
    const clear = () => setPrintJob(null);
    window.addEventListener("afterprint", clear, { once: true });
    const frame = window.requestAnimationFrame(() => window.print());
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("afterprint", clear); };
  }, [printJob]);

  const urgentFirst = [...orders].sort((a, b) => Number(b.priority === "URGENT" && !["CANCELLED", "DELIVERED"].includes(b.status)) - Number(a.priority === "URGENT" && !["CANCELLED", "DELIVERED"].includes(a.status)));

  return (
    <>
      <div className="orders-tabs" role="tablist" aria-label="Orders">
        <button role="tab" aria-selected={tab === "orders"} className={tab === "orders" ? "is-selected" : ""} onClick={() => setTab("orders")}>Orders</button>
        {canSamples && <button role="tab" aria-selected={tab === "receive"} className={tab === "receive" ? "is-selected" : ""} onClick={() => setTab("receive")}><ScanBarcode size={14} /> Receive samples</button>}
      </div>

      {tab === "receive" && canSamples
        ? <ReceivePanel onScanned={(order) => { applyChange(order); reload(); }} onOpen={(id) => { setOpenId(id); setTab("orders"); }} />
        : (
          <section className="panel-card orders-card">
            <header className="panel-header">
              <div>
                <h2 className="panel-title">Test orders</h2>
                <p className="panel-description">Place orders, collect samples and follow each order to the lab.</p>
              </div>
              <div className="inventory-row-actions">
                <ExportButtons dataset="orders" range filters={{ status }} />
                {canOrders && <button type="button" className="button-primary" onClick={() => setCreating(true)}><Plus size={14} /> New order</button>}
              </div>
            </header>
            <div className="test-catalog-filters">
              <label className="patient-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, patient, phone or sample code" aria-label="Search orders" /></label>
              <div className="test-kind-filter" role="group" aria-label="Show">
                {FILTERS.map((filter) => <button key={filter.value} type="button" className={status === filter.value ? "is-selected" : ""} aria-pressed={status === filter.value} onClick={() => setStatus(filter.value)}>{filter.label}</button>)}
              </div>
            </div>
            {gate ?? (
              <>
                <div className="table-scroll">
                  <table className="data-table orders-table">
                    <thead><tr><th>Order</th><th>Patient</th><th>Tests</th><th>Samples</th><th>Status</th><th>Payment</th><th><span className="sr-only">Open</span></th></tr></thead>
                    <tbody>
                      {urgentFirst.map((order) => (
                        <tr key={order.id} className="orders-row" onClick={() => setOpenId(order.id)}>
                          <td><strong>{order.orderCode}</strong>{order.priority === "URGENT" && <span className="order-urgent">Urgent</span>}<div className="cell-secondary">{formatClinicDate(order.orderedAt)} {formatClinicTime(order.orderedAt)}</div></td>
                          <td><strong>{order.patient.name}</strong><div className="cell-secondary">{order.patient.patientCode} · {order.patient.phone}</div></td>
                          <td>{order.items.slice(0, 2).map((item) => item.testName).join(", ")}{order.items.length > 2 ? ` +${order.items.length - 2} more` : ""}</td>
                          <td>{sampleSummary(order.samples)}{resultsSummary(order) && <div className="cell-secondary">{resultsSummary(order)}</div>}</td>
                          <td><span className={`order-status order-status-${order.status.toLowerCase().replaceAll("_", "-")}`}>{STATUS_LABEL[order.status as OrderStatus]}</span></td>
                          <td>{order.invoice ? (Number(order.invoice.due) > 0 && order.status !== "CANCELLED" ? <>Due <strong>{currency.format(Number(order.invoice.due))}</strong></> : order.status === "CANCELLED" ? "—" : "Paid") : "—"}</td>
                          <td><button type="button" className="request-action" onClick={(event) => { event.stopPropagation(); setOpenId(order.id); }}>Open</button></td>
                        </tr>
                      ))}
                      {!orders.length && <tr><td colSpan={7}>{debouncedSearch || status !== "OPEN" ? "No orders match your filters." : "No open orders. Place a new order to get started."}</td></tr>}
                    </tbody>
                  </table>
                </div>
                {nextCursor && <div className="orders-more"><button type="button" className="button-secondary" onClick={loadMore} disabled={loadingMore}>{loadingMore ? "Loading…" : "Load more"}</button></div>}
              </>
            )}
          </section>
        )}

      {creating && (
        <NewOrderDialog
          onClose={() => setCreating(false)}
          onCreated={(order) => {
            setCreating(false);
            applyChange(order);
            setOpenId(order.id);
            reload();
            onNotice(`Order ${order.orderCode} placed.`, false);
          }}
        />
      )}
      {open && (
        <OrderDetailsDialog
          order={open}
          canOrders={canOrders}
          canSamples={canSamples}
          canEnter={canEnter}
          canVerify={canVerify}
          canRelease={canRelease}
          canSend={canSend}
          onClose={() => setOpenId(null)}
          onChange={(order) => { applyChange(order); reload(); }}
          onPrint={(kind) => setPrintJob({ kind, order: open })}
        />
      )}
      {printJob?.kind === "labels" && <SampleLabelsSheet order={printJob.order} />}
      {printJob?.kind === "slip" && <OrderSlipSheet order={printJob.order} />}
    </>
  );
}

/** The lab scans (or types) a sample's barcode; each scan marks that sample received. */
function ReceivePanel({ onScanned, onOpen }: { onScanned: (order: OrderRecord) => void; onOpen: (orderId: string) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<ScanEntry[]>([]);
  const [lastOrder, setLastOrder] = useState<OrderRecord | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const counter = useRef(0);

  useEffect(() => { input.current?.focus(); }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const result = await requestJson<{ order: OrderRecord; sampleCode: string }>(await fetch("/api/samples/scan", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: value }),
      }));
      setLastOrder(result.order);
      onScanned(result.order);
      setLog((current) => [{ id: ++counter.current, ok: true, text: `${result.sampleCode} received · ${result.order.patient.name} · ${result.order.orderCode}` }, ...current].slice(0, 12));
    } catch (scanError) {
      setLastOrder(null);
      setLog((current) => [{ id: ++counter.current, ok: false, text: `${value.toUpperCase()}: ${scanError instanceof Error ? scanError.message : "Could not receive."}` }, ...current].slice(0, 12));
    } finally {
      setBusy(false);
      setCode("");
      input.current?.focus();
    }
  }

  return (
    <section className="panel-card orders-card receive-panel">
      <header className="panel-header"><div><h2 className="panel-title">Receive samples</h2><p className="panel-description">Scan the barcode on each tube as it reaches the lab. A scanner types the code and presses Enter.</p></div></header>
      <form className="receive-form" onSubmit={submit}>
        <label className="form-field">Sample code
          <input ref={input} value={code} onChange={(event) => setCode(event.target.value)} placeholder="SMP-000123" autoComplete="off" spellCheck={false} maxLength={40} inputMode="text" />
        </label>
        <button className="button-primary" type="submit" disabled={busy || !code.trim()}>{busy ? "Receiving…" : "Receive"}</button>
      </form>
      {lastOrder && (
        <div className="receive-last" role="status">
          <strong>{lastOrder.patient.name}</strong> · {lastOrder.orderCode} · {STATUS_LABEL[lastOrder.status]}
          <button type="button" className="request-action" onClick={() => onOpen(lastOrder.id)}>Open order</button>
        </div>
      )}
      <ul className="receive-log" aria-label="Recent scans" aria-live="polite">
        {log.map((entry) => <li key={entry.id} className={entry.ok ? "is-ok" : "is-error"}>{entry.text}</li>)}
        {!log.length && <li className="receive-empty">Nothing scanned yet.</li>}
      </ul>
    </section>
  );
}
