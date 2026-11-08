"use client";

import ExportButtons from "@/modules/export/components/export-buttons";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { bdtCurrency } from "@/lib/format";
import { formatStatus } from "@/lib/status-labels";
import { formatClinicDateTime } from "@/lib/clinic-date";
import { Metric, localDate } from "@/modules/clinic/components/section-shared";
import { useInventoryReport, useMovements } from "./inventory-queries";
import { shortDate } from "./inventory-types";

const typeLabel = { PURCHASE: "Purchase", ISSUE: "Used", ADJUSTMENT: "Adjustment" } as const;

// Every stock change, newest first, plus the period report (purchases, usage, losses, stock value).
export default function HistoryTab() {
  const [from, setFrom] = useState(() => localDate(29));
  const [to, setTo] = useState(() => localDate());
  const [type, setType] = useState("");
  const invalidRange = from > to;
  const query = `from=${from}&to=${to}${type ? `&type=${type}` : ""}`;
  // Cached per range and type; "Load more" fetches the next page of the same list.
  const movementsQuery = useMovements(query, !invalidRange);
  const reportQuery = useInventoryReport(from, to, !invalidRange);
  const movements = movementsQuery.data?.pages.flatMap((page) => page.movements) ?? [];
  const report = reportQuery.data;

  if (!invalidRange && (movementsQuery.isPending || reportQuery.isPending)) return <div className="loading-state" role="status">Loading inventory data…</div>;
  if (movementsQuery.isError || reportQuery.isError) {
    return <section className="panel-card patient-load-error" role="alert">{(movementsQuery.error ?? reportQuery.error)?.message ?? "Unable to load inventory."}<button className="button-secondary" onClick={() => { void movementsQuery.refetch(); void reportQuery.refetch(); }}>Retry</button></section>;
  }

  return (
    <section className="panel-card clinic-module-card">
      <header className="panel-header"><div><h2 className="panel-title">Inventory reports and history</h2><p className="panel-description">What was bought and used, losses from adjustments, and every stock change.</p></div><ExportButtons dataset="inventory-movements" dates={{ from, to }} filters={{ status: type }} /></header>
      <div className="inventory-toolbar">
        <label className="form-field">From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="form-field">To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
        <label className="form-field">Type<select value={type} onChange={(event) => setType(event.target.value)}><option value="">All changes</option><option value="PURCHASE">Purchases</option><option value="ISSUE">Used</option><option value="ADJUSTMENT">Adjustments</option></select></label>
        <button type="button" className="button-secondary" disabled={movementsQuery.isFetching} onClick={() => { void movementsQuery.refetch(); void reportQuery.refetch(); }}><RefreshCw size={14} /> Refresh</button>
      </div>
      {invalidRange && <div className="form-error" role="alert">The start date must be on or before the end date.</div>}
      {report && (
        <>
          <div className="clinic-report-cards">
            <Metric label="Purchased" value={bdtCurrency.format(Number(report.purchases.total))} />
            <Metric label="Purchases" value={report.purchases.count} />
            <Metric label="Written off / lost" value={`${report.adjustments.lostQuantity} (${bdtCurrency.format(Number(report.adjustments.lostValue))})`} />
            <Metric label="Stock value now" value={bdtCurrency.format(report.stockValueByCategory.reduce((sum, row) => sum + Number(row.value), 0))} />
          </div>
          <div className="clinic-report-columns">
            <div><h3 className="clinic-subheading">Most used</h3>{report.usage.length ? report.usage.slice(0, 10).map((row) => <p key={row.id}>{row.name} <strong>{row.quantity} {row.unit}</strong></p>) : <p>No stock used</p>}</div>
            <div><h3 className="clinic-subheading">Bought from</h3>{report.purchases.bySupplier.length ? report.purchases.bySupplier.map((row) => <p key={row.supplier}>{row.supplier} <strong>{bdtCurrency.format(Number(row.total))}</strong></p>) : <p>No purchases</p>}</div>
            <div><h3 className="clinic-subheading">Stock value by category</h3>{report.stockValueByCategory.length ? report.stockValueByCategory.map((row) => <p key={row.category}>{row.category} <strong>{bdtCurrency.format(Number(row.value))}</strong></p>) : <p>No items</p>}</div>
          </div>
        </>
      )}
      <h3 className="clinic-subheading">Stock changes</h3>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>When</th><th>Item</th><th>Type</th><th className="numeric">Change</th><th>Batch</th><th>Reason</th><th>By</th></tr></thead><tbody>
        {movements.map((row) => (
          <tr key={row.id}>
            <td>{formatClinicDateTime(row.createdAt)}</td>
            <td>{row.item.name}</td>
            <td>{typeLabel[row.type] ?? formatStatus(row.type)}</td>
            <td className={`numeric ${row.quantity < 0 ? "inventory-bad" : "inventory-good"}`}>{row.quantity > 0 ? "+" : ""}{row.quantity} {row.item.unit}</td>
            <td>{row.batch ? `${row.batch.batchNumber ?? "—"}${row.batch.expiryDate ? ` · exp ${shortDate(row.batch.expiryDate)}` : ""}` : "—"}</td>
            <td>{row.reason ?? "—"}</td>
            <td>{row.createdBy?.name ?? "—"}</td>
          </tr>
        ))}
        {!movements.length && <tr><td colSpan={7}>No stock changes in this period.</td></tr>}
      </tbody></table></div>
      {movementsQuery.hasNextPage && <div className="appointment-load-more"><button type="button" className="button-secondary" disabled={movementsQuery.isFetchingNextPage} onClick={() => void movementsQuery.fetchNextPage()}>{movementsQuery.isFetchingNextPage ? "Loading…" : "Load more"}</button></div>}
    </section>
  );
}
