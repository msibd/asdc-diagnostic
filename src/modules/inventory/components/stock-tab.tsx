"use client";

import { AlertTriangle, Minus, Pencil, Plus, SlidersHorizontal, Upload, X } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import DataTable, { dataTableColumns } from "@/components/shared/data-table";
import Modal from "@/components/shared/modal";
import { bdtCurrency } from "@/lib/format";
import ImportDialog from "@/modules/import/components/import-dialog";
import { Metric, localDate } from "@/modules/clinic/components/section-shared";
import { useInventoryItems, useInventoryMutation, useSuppliers } from "./inventory-queries";
import { shortDate, type InventoryItemRow } from "./inventory-types";

type Notice = (message: string, error: boolean) => void;
type Dialog =
  | { kind: "item"; item: InventoryItemRow | null }
  | { kind: "issue"; item: InventoryItemRow }
  | { kind: "adjust"; item: InventoryItemRow }
  | null;

const FILTERS = [
  { value: "ALL", label: "All items" },
  { value: "LOW", label: "Low stock" },
  { value: "OUT", label: "Out of stock" },
  { value: "EXPIRING", label: "Expiring soon" },
  { value: "EXPIRED", label: "Expired" },
] as const;

const statusLabel = { OK: "In stock", LOW: "Low stock", OUT: "Out of stock" } as const;
const statusClass = { OK: "invoice-status-paid", LOW: "invoice-status-partially-paid", OUT: "invoice-status-void" } as const;
const statusRank = { OUT: 0, LOW: 1, OK: 2 } as const;
const column = dataTableColumns<InventoryItemRow>();

function DialogShell({ title, description, busy, onClose, onSubmit, children, submitLabel, error }: {
  title: string; description?: string; busy: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode; submitLabel: string; error: string;
}) {
  return (
    <Modal labelledBy="inventory-dialog-title" onRequestClose={() => { if (!busy) onClose(); }}>
      <form className="modal-form" onSubmit={onSubmit}>
        <div className="modal-heading">
          <div><h2 id="inventory-dialog-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog" disabled={busy}><X size={16} /></button>
        </div>
        {children}
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="button-primary" disabled={busy}>{busy ? "Saving…" : submitLabel}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function StockTab({ canWrite, onNotice }: { canWrite: boolean; onNotice: Notice }) {
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("ALL");
  const [category, setCategory] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  // Cached and shared with the other inventory tabs; refreshed after changes and on realtime events.
  const itemsQuery = useInventoryItems(showInactive);
  const suppliers = useSuppliers().data ?? [];
  const mutation = useInventoryMutation();
  const busy = mutation.isPending;
  const overview = itemsQuery.data;

  const items = overview?.items;
  const categories = useMemo(() => [...new Set((items ?? []).map((item) => item.category))].sort(), [items]);
  // The status and category filters narrow the list; the search box and sorting live in the table.
  const visible = useMemo(() => (items ?? []).filter((item) => {
    if (category && item.category !== category) return false;
    if (filter === "LOW") return item.status === "LOW";
    if (filter === "OUT") return item.status === "OUT";
    if (filter === "EXPIRING") return item.expiringQuantity > 0;
    if (filter === "EXPIRED") return item.expiredQuantity > 0;
    return true;
  }), [items, filter, category]);

  const columns = useMemo(() => column.columns([
    column.accessor((item) => `${item.name} ${item.sku} ${item.supplier?.name ?? ""}`, {
      id: "item",
      header: "Item",
      sortFn: (a, b) => a.original.name.localeCompare(b.original.name),
      cell: ({ row: { original: item } }) => (
        <><strong>{item.name}</strong><div className="cell-secondary">{item.sku}{item.supplier ? ` · ${item.supplier.name}` : ""}{item.isActive ? "" : " · inactive"}</div></>
      ),
    }),
    column.accessor("category", { header: "Category" }),
    column.accessor("quantity", { header: "On hand", meta: { numeric: true }, enableGlobalFilter: false, cell: ({ row: { original: item } }) => `${item.quantity} ${item.unit}` }),
    column.accessor("reorderLevel", { header: "Reorder at", meta: { numeric: true }, enableGlobalFilter: false, cell: ({ getValue }) => getValue() || "—" }),
    column.accessor((item) => item.nextExpiry ?? "9999-12-31", {
      id: "expiry",
      header: "Next expiry",
      enableGlobalFilter: false,
      cell: ({ row: { original: item } }) => (
        <>
          {item.nextExpiry ? shortDate(item.nextExpiry) : "—"}
          {item.expiredQuantity > 0 && <div className="cell-secondary inventory-bad">{item.expiredQuantity} expired</div>}
          {item.expiredQuantity === 0 && item.expiringQuantity > 0 && <div className="cell-secondary inventory-warn">{item.expiringQuantity} expiring soon</div>}
        </>
      ),
    }),
    column.accessor((item) => statusRank[item.status], {
      id: "status",
      header: "Status",
      enableGlobalFilter: false,
      cell: ({ row: { original: item } }) => <span className={`invoice-status ${statusClass[item.status]}`}>{statusLabel[item.status]}</span>,
    }),
    ...(canWrite ? [column.display({
      id: "actions",
      header: "Actions",
      cell: ({ row: { original: item } }) => (
        <div className="inventory-row-actions">
          <button type="button" className="request-action" disabled={!item.isActive || item.quantity === 0} onClick={() => { setError(""); setDialog({ kind: "issue", item }); }}><Minus size={12} /> Use</button>
          <button type="button" className="request-action" onClick={() => { setError(""); setDialog({ kind: "adjust", item }); }}><SlidersHorizontal size={12} /> Adjust</button>
          <button type="button" className="request-action" onClick={() => { setError(""); setDialog({ kind: "item", item }); }}><Pencil size={12} /> Edit</button>
        </div>
      ),
    })] : []),
  ]), [canWrite]);

  function send(url: string, method: "POST" | "PATCH", body: unknown, success: string) {
    setError("");
    mutation.mutate({ url, method, body }, {
      onSuccess: () => { setDialog(null); onNotice(success, false); },
      onError: (failure) => setError(failure instanceof Error ? failure.message : "Unable to save."),
    });
  }

  if (itemsQuery.isPending) return <div className="loading-state" role="status">Loading inventory data…</div>;
  if (itemsQuery.isError || !overview) {
    return <section className="panel-card patient-load-error" role="alert">{itemsQuery.error?.message ?? "Unable to load inventory."}<button className="button-secondary" onClick={() => void itemsQuery.refetch()}>Retry</button></section>;
  }
  const { summary } = overview;
  const text = (data: FormData, name: string) => String(data.get(name) ?? "");

  return (
    <>
      <div className="clinic-report-cards" aria-label="Stock summary">
        <Metric label="Active items" value={summary.itemCount} />
        <Metric label="Low stock" value={summary.low} />
        <Metric label="Out of stock" value={summary.out} />
        <Metric label="Expiring in 30 days" value={summary.expiring} />
        <Metric label="With expired stock" value={summary.expired} />
        <Metric label="Stock value" value={bdtCurrency.format(Number(summary.stockValue))} />
      </div>
      {(summary.low + summary.out + summary.expired + summary.expiring > 0) && (
        <div className="inventory-alert" role="status">
          <AlertTriangle size={15} />
          <span>
            {summary.out > 0 && `${summary.out} out of stock. `}
            {summary.low > 0 && `${summary.low} running low. `}
            {summary.expired > 0 && `${summary.expired} with expired stock to write off. `}
            {summary.expiring > 0 && `${summary.expiring} expiring within 30 days.`}
          </span>
        </div>
      )}

      <section className="panel-card clinic-module-card">
        <header className="panel-header">
          <div><h2 className="panel-title">Stock</h2><p className="panel-description">Reagents and lab supplies on hand. Stock is used oldest expiry first.</p></div>
          {canWrite && <div className="inventory-row-actions"><button className="button-secondary" onClick={() => setImporting(true)}><Upload size={14} /> Import CSV</button><button className="button-primary" onClick={() => { setError(""); setDialog({ kind: "item", item: null }); }}><Plus size={14} /> Add item</button></div>}
        </header>
        <div className="inventory-toolbar">
          <label className="form-field">Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, code, category or supplier" /></label>
          <label className="form-field">Show<select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>{FILTERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="form-field">Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label className="inventory-check"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> Show inactive</label>
        </div>
        <DataTable
          data={visible}
          columns={columns}
          search={search}
          caption="Inventory items"
          getRowId={(item) => item.id}
          rowClassName={(item) => (item.isActive ? undefined : "expense-voided")}
          emptyMessage={overview.items.length ? "No items match these filters." : "No items yet. Add an item, then record a purchase to bring in stock."}
        />
      </section>

      {importing && <ImportDialog module="inventory-items" onClose={() => setImporting(false)} onImported={() => void itemsQuery.refetch()} />}

      {dialog?.kind === "item" && (
        <DialogShell title={dialog.item ? "Edit item" : "Add item"} description="Stock quantity changes through purchases, use and adjustments, not here." busy={busy} error={error} submitLabel={dialog.item ? "Save changes" : "Add item"} onClose={() => setDialog(null)}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            const body = {
              name: text(data, "name"), category: text(data, "category") || "Reagents", unit: text(data, "unit") || "pcs",
              reorderLevel: Number(text(data, "reorderLevel") || 0), supplierId: text(data, "supplierId") || null, notes: text(data, "notes") || null,
              ...(dialog.item ? { isActive: data.get("isActive") === "on" } : {}),
            };
            void send(dialog.item ? `/api/inventory/items/${dialog.item.id}` : "/api/inventory/items", dialog.item ? "PATCH" : "POST", body, dialog.item ? "Item updated." : "Item added.");
          }}>
          <div className="form-grid">
            <label className="form-field">Name *<input name="name" required minLength={2} maxLength={120} autoFocus defaultValue={dialog.item?.name} /></label>
            <label className="form-field">Category<input name="category" maxLength={60} list="inventory-categories" defaultValue={dialog.item?.category ?? "Reagents"} /></label>
            <label className="form-field">Unit *<input name="unit" required maxLength={20} placeholder="pcs, box, ml…" defaultValue={dialog.item?.unit ?? "pcs"} /></label>
            <label className="form-field">Reorder level<input name="reorderLevel" type="number" inputMode="numeric" min="0" step="1" defaultValue={dialog.item?.reorderLevel ?? 0} /><small>A low-stock alert shows at or below this number. 0 turns it off.</small></label>
          </div>
          <datalist id="inventory-categories">{categories.map((item) => <option key={item} value={item} />)}</datalist>
          <label className="form-field">Usual supplier<select name="supplierId" defaultValue={dialog.item?.supplier?.id ?? ""}><option value="">None</option>{suppliers.filter((supplier) => supplier.isActive || supplier.id === dialog.item?.supplier?.id).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
          <label className="form-field">Notes<input name="notes" maxLength={1000} defaultValue={dialog.item?.notes ?? ""} /></label>
          {dialog.item && <label className="inventory-check"><input type="checkbox" name="isActive" defaultChecked={dialog.item.isActive} /> Active (inactive items are hidden from purchases and use)</label>}
        </DialogShell>
      )}

      {dialog?.kind === "issue" && (
        <DialogShell title={`Use stock: ${dialog.item.name}`} description={`${dialog.item.quantity} ${dialog.item.unit} on hand. Expired stock is never used.`} busy={busy} error={error} submitLabel="Record use" onClose={() => setDialog(null)}
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void send("/api/inventory/movements", "POST", { itemId: dialog.item.id, kind: "ISSUE", quantity: Number(text(data, "quantity")), reason: text(data, "reason") }, "Stock use recorded.");
          }}>
          <label className="form-field">Quantity ({dialog.item.unit}) *<input name="quantity" type="number" inputMode="numeric" required min="1" step="1" autoFocus /></label>
          <label className="form-field">Used for *<input name="reason" required minLength={3} maxLength={300} placeholder="e.g. Filling, patient PID-00012" /></label>
        </DialogShell>
      )}

      {dialog?.kind === "adjust" && <AdjustDialog item={dialog.item} busy={busy} error={error} onClose={() => setDialog(null)} onSend={(body) => void send("/api/inventory/movements", "POST", body, "Stock adjusted.")} />}
    </>
  );
}

function AdjustDialog({ item, busy, error, onClose, onSend }: {
  item: InventoryItemRow; busy: boolean; error: string; onClose: () => void; onSend: (body: unknown) => void;
}) {
  const [direction, setDirection] = useState<"ADJUST_OUT" | "ADJUST_IN">("ADJUST_OUT");
  return (
    <DialogShell title={`Adjust stock: ${item.name}`} description={`${item.quantity} ${item.unit} on hand. Use this for a stock-take difference, damage, or to write off expired stock.`} busy={busy} error={error} submitLabel="Save adjustment" onClose={onClose}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSend({
          itemId: item.id, kind: direction, quantity: Number(data.get("quantity")), reason: String(data.get("reason") ?? ""),
          ...(direction === "ADJUST_OUT" && data.get("batchId") ? { batchId: String(data.get("batchId")) } : {}),
          ...(direction === "ADJUST_IN" && data.get("expiryDate") ? { expiryDate: String(data.get("expiryDate")) } : {}),
        });
      }}>
      <div className="form-grid">
        <label className="form-field">Change<select value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)}><option value="ADJUST_OUT">Remove stock (loss, damage, expired)</option><option value="ADJUST_IN">Add stock (found, opening balance)</option></select></label>
        <label className="form-field">Quantity ({item.unit}) *<input name="quantity" type="number" inputMode="numeric" required min="1" step="1" autoFocus /></label>
      </div>
      {direction === "ADJUST_OUT" && (
        <label className="form-field">Which batch<select name="batchId" defaultValue=""><option value="">Oldest expiry first</option>{item.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batchNumber ? `${batch.batchNumber} · ` : ""}{batch.expiryDate ? `expires ${shortDate(batch.expiryDate)}` : "no expiry"} · {batch.quantityRemaining} left{batch.expiry === "EXPIRED" ? " · EXPIRED" : ""}</option>)}</select></label>
      )}
      {direction === "ADJUST_IN" && <label className="form-field">Expiry date<input name="expiryDate" type="date" min={localDate(-1)} /></label>}
      <label className="form-field">Reason *<input name="reason" required minLength={3} maxLength={300} placeholder="e.g. Stock-take count, expired batch" /></label>
    </DialogShell>
  );
}
