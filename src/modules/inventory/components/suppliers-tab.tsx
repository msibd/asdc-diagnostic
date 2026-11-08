"use client";

import { Pencil, Plus, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import Modal from "@/components/shared/modal";
import { bdtCurrency } from "@/lib/format";
import { useInventoryMutation, useSuppliers } from "./inventory-queries";
import type { SupplierRow } from "./inventory-types";

export default function SuppliersTab({ canWrite, onNotice }: { canWrite: boolean; onNotice: (message: string, error: boolean) => void }) {
  const [editing, setEditing] = useState<SupplierRow | "new" | null>(null);
  const [error, setError] = useState("");
  const suppliersQuery = useSuppliers();
  const suppliers = suppliersQuery.data ?? [];
  const mutation = useInventoryMutation();
  const busy = mutation.isPending;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "").trim() || null;
    setError("");
    mutation.mutate({
      url: editing === "new" ? "/api/inventory/suppliers" : `/api/inventory/suppliers/${editing.id}`,
      method: editing === "new" ? "POST" : "PATCH",
      body: {
        name: String(data.get("name") ?? ""), contactPerson: field("contactPerson"), phone: field("phone"), email: field("email"),
        address: field("address"), notes: field("notes"),
        ...(editing === "new" ? {} : { isActive: data.get("isActive") === "on" }),
      },
    }, {
      onSuccess: () => { onNotice(editing === "new" ? "Supplier added." : "Supplier updated.", false); setEditing(null); },
      onError: (failure) => setError(failure instanceof Error ? failure.message : "Unable to save the supplier."),
    });
  }

  if (suppliersQuery.isPending) return <div className="loading-state" role="status">Loading inventory data…</div>;
  if (suppliersQuery.isError) return <section className="panel-card patient-load-error" role="alert">{suppliersQuery.error?.message ?? "Unable to load inventory."}<button className="button-secondary" onClick={() => void suppliersQuery.refetch()}>Retry</button></section>;
  const current = editing && editing !== "new" ? editing : null;

  return (
    <section className="panel-card clinic-module-card">
      <header className="panel-header">
        <div><h2 className="panel-title">Suppliers</h2><p className="panel-description">Who you buy reagents and lab supplies from.</p></div>
        {canWrite && <button className="button-primary" onClick={() => { setError(""); setEditing("new"); }}><Plus size={14} /> Add supplier</button>}
      </header>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Supplier</th><th>Contact</th><th className="numeric">Items</th><th className="numeric">Purchases</th><th className="numeric">Total bought</th>{canWrite && <th>Action</th>}</tr></thead><tbody>
        {suppliers.map((supplier) => (
          <tr key={supplier.id} className={supplier.isActive ? undefined : "expense-voided"}>
            <td><strong>{supplier.name}</strong>{!supplier.isActive && <div className="cell-secondary">Inactive</div>}</td>
            <td>{supplier.contactPerson ?? "—"}<div className="cell-secondary">{[supplier.phone, supplier.email].filter(Boolean).join(" · ")}</div></td>
            <td className="numeric">{supplier.itemCount}</td>
            <td className="numeric">{supplier.purchaseCount}</td>
            <td className="numeric">{bdtCurrency.format(Number(supplier.totalPurchased))}</td>
            {canWrite && <td><button type="button" className="request-action" onClick={() => { setError(""); setEditing(supplier); }}><Pencil size={12} /> Edit</button></td>}
          </tr>
        ))}
        {!suppliers.length && <tr><td colSpan={canWrite ? 6 : 5}>No suppliers yet.</td></tr>}
      </tbody></table></div>

      {editing && (
        <Modal labelledBy="supplier-title" onRequestClose={() => { if (!busy) setEditing(null); }}>
          <form className="modal-form" onSubmit={submit}>
            <div className="modal-heading">
              <div><h2 id="supplier-title">{current ? "Edit supplier" : "Add supplier"}</h2></div>
              <button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Close dialog" disabled={busy}><X size={16} /></button>
            </div>
            <div className="form-grid">
              <label className="form-field">Name *<input name="name" required minLength={2} maxLength={120} autoFocus defaultValue={current?.name} /></label>
              <label className="form-field">Contact person<input name="contactPerson" maxLength={120} defaultValue={current?.contactPerson ?? ""} /></label>
              <label className="form-field">Phone<input name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={current?.phone ?? ""} /></label>
              <label className="form-field">Email<input name="email" type="email" autoComplete="email" maxLength={160} defaultValue={current?.email ?? ""} /></label>
            </div>
            <label className="form-field">Address<input name="address" maxLength={500} defaultValue={current?.address ?? ""} /></label>
            <label className="form-field">Notes<input name="notes" maxLength={1000} defaultValue={current?.notes ?? ""} /></label>
            {current && <label className="inventory-check"><input type="checkbox" name="isActive" defaultChecked={current.isActive} /> Active</label>}
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
              <button className="button-primary" disabled={busy}>{busy ? "Saving…" : "Save supplier"}</button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
