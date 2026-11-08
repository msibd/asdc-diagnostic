"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import Modal from "@/components/shared/modal";
import { bdtCurrency } from "@/lib/format";
import { formatStatus } from "@/lib/status-labels";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import { localDate } from "@/modules/clinic/components/section-shared";
import { inventoryKeys, useInventoryItems, usePurchases, useSuppliers } from "./inventory-queries";
import { emptyPurchaseLine, purchaseFormSchema, type PurchaseFormValues } from "@/modules/inventory/inventory-schema";
import { shortDate, type InventoryOverview, type SupplierRow } from "./inventory-types";

const methods = ["CASH", "CARD", "MOBILE_BANKING", "BANK_TRANSFER"] as const;

export default function PurchasesTab({ canWrite, onNotice }: { canWrite: boolean; onNotice: (message: string, error: boolean) => void }) {
  const [from, setFrom] = useState(() => `${localDate().slice(0, 7)}-01`);
  const [to, setTo] = useState(() => localDate());
  const [open, setOpen] = useState(false);
  const invalidRange = from > to;
  const queryClient = useQueryClient();
  const purchasesQuery = usePurchases(from, to, !invalidRange);
  const items = useInventoryItems(false).data?.items ?? [];
  const suppliers = useSuppliers().data ?? [];
  const purchases = purchasesQuery.data?.pages.flatMap((page) => page.purchases) ?? [];
  const total = purchasesQuery.data?.pages[0]?.total ?? "0.00";

  if (purchasesQuery.isPending && !invalidRange) return <div className="loading-state" role="status">Loading inventory data…</div>;
  if (purchasesQuery.isError) return <section className="panel-card patient-load-error" role="alert">{purchasesQuery.error?.message ?? "Unable to load inventory."}<button className="button-secondary" onClick={() => void purchasesQuery.refetch()}>Retry</button></section>;
  const activeItems = items.filter((item) => item.isActive);

  return (
    <section className="panel-card clinic-module-card">
      <header className="panel-header">
        <div><h2 className="panel-title">Purchases</h2><p className="panel-description">Record stock bought from suppliers. Each line becomes a batch with its own expiry date.</p></div>
        {canWrite && <button className="button-primary" onClick={() => setOpen(true)}><Plus size={14} /> Record purchase</button>}
      </header>
      <div className="inventory-toolbar">
        <label className="form-field">From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="form-field">To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
        <div className="expense-total" aria-live="polite"><span>Purchased in period</span><strong>{bdtCurrency.format(Number(total))}</strong></div>
      </div>
      {invalidRange && <div className="form-error" role="alert">The start date must be on or before the end date.</div>}
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Purchase</th><th>Supplier</th><th>Items</th><th>Paid</th><th className="numeric">Total</th></tr></thead><tbody>
        {purchases.map((purchase) => (
          <tr key={purchase.id}>
            <td>{shortDate(purchase.purchasedAt)}</td>
            <td><strong>{purchase.purchaseCode}</strong>{purchase.invoiceNumber && <div className="cell-secondary">Invoice {purchase.invoiceNumber}</div>}</td>
            <td>{purchase.supplier?.name ?? "—"}</td>
            <td>{purchase.batches.map((batch) => <div key={batch.id}>{batch.item.name} × {batch.quantityReceived} {batch.item.unit}{batch.expiryDate ? <span className="cell-secondary"> · exp {shortDate(batch.expiryDate)}</span> : null}</div>)}</td>
            <td>{purchase.expense ? (purchase.expense.voidedAt ? "Expense voided" : `Paid · ${formatStatus(purchase.expense.method)}`) : "Not recorded as expense"}</td>
            <td className="numeric">{bdtCurrency.format(Number(purchase.totalCost))}</td>
          </tr>
        ))}
        {!purchases.length && <tr><td colSpan={6}>No purchases in this period.</td></tr>}
      </tbody></table></div>
      {purchasesQuery.hasNextPage && <div className="appointment-load-more"><button type="button" className="button-secondary" disabled={purchasesQuery.isFetchingNextPage} onClick={() => void purchasesQuery.fetchNextPage()}>{purchasesQuery.isFetchingNextPage ? "Loading…" : "Load more"}</button></div>}

      {open && (
        <PurchaseFormModal
          items={activeItems}
          suppliers={suppliers.filter((supplier) => supplier.isActive)}
          onClose={() => setOpen(false)}
          onSaved={() => { setOpen(false); onNotice("Purchase recorded and stock updated.", false); void queryClient.invalidateQueries({ queryKey: inventoryKeys.all }); }}
        />
      )}
    </section>
  );
}

/**
 * The "Record purchase" dialog. React Hook Form + the purchase schema (inventory-schema.ts): each
 * line is checked as it is filled in, expiry dates are checked against the purchase date, and the
 * total updates live. The server checks everything again.
 */
function PurchaseFormModal({ items, suppliers, onClose, onSaved }: {
  items: InventoryOverview["items"];
  suppliers: SupplierRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState("");
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseFormSchema),
    defaultValues: {
      purchasedAt: localDate(), supplierId: "", invoiceNumber: "", note: "",
      recordExpense: true, paymentMethod: "CASH", lines: [emptyPurchaseLine()],
    },
    mode: "onTouched",
  });
  const lines = useFieldArray({ control, name: "lines" });
  const watched = useWatch({ control });
  const totalCents = (watched.lines ?? []).reduce((sum, line) => sum + Math.round(Number(line?.unitCost || 0) * 100) * Number(line?.quantity || 0), 0);

  async function save(values: PurchaseFormValues) {
    setError("");
    try {
      await requestJson(await fetch("/api/inventory/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: values.supplierId || null,
          invoiceNumber: values.invoiceNumber || null,
          purchasedAt: values.purchasedAt,
          note: values.note || null,
          recordExpense: values.recordExpense,
          paymentMethod: values.paymentMethod,
          lines: values.lines.map((line) => ({
            itemId: line.itemId, quantity: Number(line.quantity), unitCost: Number(line.unitCost),
            batchNumber: line.batchNumber || null, expiryDate: line.expiryDate || null,
          })),
        }),
      }));
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to record the purchase.");
    }
  }

  const fieldError = (message?: string) => (message ? <small className="field-error" role="alert">{message}</small> : null);

  return (
    <Modal className="inventory-wide-modal" labelledBy="purchase-title" onRequestClose={() => { if (!isSubmitting) onClose(); }}>
      <form className="modal-form" noValidate onSubmit={handleSubmit(save)}>
        <div className="modal-heading">
          <div><h2 id="purchase-title">Record purchase</h2><p>Adds the quantities below to stock as new batches.</p></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog" disabled={isSubmitting}><X size={16} /></button>
        </div>
        <div className="form-grid">
          <label className="form-field">Purchase date *<input type="date" max={localDate()} aria-invalid={errors.purchasedAt ? true : undefined} {...register("purchasedAt")} />{fieldError(errors.purchasedAt?.message)}</label>
          <label className="form-field">Supplier<select {...register("supplierId")}><option value="">No supplier</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
          <label className="form-field">Supplier invoice no.<input maxLength={80} {...register("invoiceNumber")} />{fieldError(errors.invoiceNumber?.message)}</label>
          <label className="form-field">Note<input maxLength={1000} {...register("note")} />{fieldError(errors.note?.message)}</label>
        </div>
        <div className="purchase-lines">
          {lines.fields.map((line, index) => {
            const lineErrors = errors.lines?.[index];
            return (
              <div className="purchase-line" key={line.id}>
                <label className="form-field">Item *<select aria-invalid={lineErrors?.itemId ? true : undefined} {...register(`lines.${index}.itemId`)}><option value="" disabled>Select item</option>{items.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select>{fieldError(lineErrors?.itemId?.message)}</label>
                <label className="form-field">Qty *<input type="number" min="1" step="1" inputMode="numeric" aria-invalid={lineErrors?.quantity ? true : undefined} {...register(`lines.${index}.quantity`)} />{fieldError(lineErrors?.quantity?.message)}</label>
                <label className="form-field">Unit cost (BDT) *<input type="number" min="0" step="0.01" inputMode="decimal" aria-invalid={lineErrors?.unitCost ? true : undefined} {...register(`lines.${index}.unitCost`)} />{fieldError(lineErrors?.unitCost?.message)}</label>
                <label className="form-field">Batch no.<input maxLength={60} {...register(`lines.${index}.batchNumber`)} />{fieldError(lineErrors?.batchNumber?.message)}</label>
                <label className="form-field">Expiry<input type="date" aria-invalid={lineErrors?.expiryDate ? true : undefined} {...register(`lines.${index}.expiryDate`)} />{fieldError(lineErrors?.expiryDate?.message)}</label>
                <button type="button" className="icon-action icon-action-danger" aria-label={`Remove line ${index + 1}`} disabled={lines.fields.length === 1} onClick={() => lines.remove(index)}><Trash2 size={15} /></button>
              </div>
            );
          })}
          {fieldError(errors.lines?.root?.message ?? errors.lines?.message)}
          <button type="button" className="button-secondary" disabled={lines.fields.length >= 50} onClick={() => lines.append(emptyPurchaseLine())}><Plus size={14} /> Add another item</button>
        </div>
        <div className="form-grid">
          <label className="inventory-check"><input type="checkbox" {...register("recordExpense")} /> Paid now: record this as a Supplies expense</label>
          {watched.recordExpense && <label className="form-field">Paid by<select {...register("paymentMethod")}>{methods.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select></label>}
        </div>
        <div className="expense-total"><span>Purchase total</span><strong>{bdtCurrency.format(totalCents / 100)}</strong></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="button-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
          <button className="button-primary" disabled={isSubmitting}>{isSubmitting ? "Saving…" : "Record purchase"}</button>
        </div>
      </form>
    </Modal>
  );
}
