"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { FlaskConical, Layers, Search, Wrench, X } from "lucide-react";
import Modal from "@/components/shared/modal";
import PatientSelect from "@/components/shared/patient-select";
import { bdtCurrency as currency } from "@/lib/format";
import { requestJson, type ServiceRecord } from "@/modules/clinic/components/clinic-types";
import type { OrderRecord } from "./order-types";

const KIND_LABEL = { TEST: "Test", PANEL: "Panel", SERVICE: "Service" } as const;
const KindIcon = ({ kind }: { kind: ServiceRecord["kind"] }) => (kind === "TEST" ? <FlaskConical size={14} /> : kind === "PANEL" ? <Layers size={14} /> : <Wrench size={14} />);

export default function NewOrderDialog({ onClose, onCreated, initialPatientId = "" }: {
  onClose: () => void;
  onCreated: (order: OrderRecord) => void;
  initialPatientId?: string;
}) {
  const [catalog, setCatalog] = useState<ServiceRecord[]>([]);
  const [catalogError, setCatalogError] = useState("");
  const [patientId, setPatientId] = useState(initialPatientId);
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<"ROUTINE" | "URGENT">("ROUTINE");
  const [referredBy, setReferredBy] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [discount, setDiscount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/services", { cache: "no-store" })
      .then((response) => requestJson<{ services: ServiceRecord[] }>(response))
      .then((result) => { if (!cancelled) setCatalog(result.services); })
      .catch((loadError) => { if (!cancelled) setCatalogError(loadError instanceof Error ? loadError.message : "Unable to load the test list."); });
    return () => { cancelled = true; };
  }, []);

  const byId = useMemo(() => new Map(catalog.map((item) => [item.id, item])), [catalog]);
  const shown = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return catalog
      .filter((item) => !picked.includes(item.id) && (!needle || `${item.name} ${item.code} ${item.category}`.toLowerCase().includes(needle)))
      // Tests and panels first: they are what this screen is for.
      .sort((a, b) => Number(a.kind === "SERVICE") - Number(b.kind === "SERVICE") || a.name.localeCompare(b.name))
      .slice(0, 60);
  }, [catalog, picked, search]);

  const subtotal = picked.reduce((sum, id) => sum + Number(byId.get(id)?.standardPrice ?? 0), 0);
  const discountValue = Number(discount) || 0;
  const total = subtotal - discountValue;
  const longestReport = Math.max(0, ...picked.map((id) => byId.get(id)?.turnaroundHours ?? 0));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!patientId) { setError("Select a patient."); return; }
    if (!picked.length) { setError("Choose at least one test."); return; }
    if (total < 0) { setError("The discount cannot be more than the total."); return; }
    setSaving(true);
    setError("");
    try {
      const result = await requestJson<{ order: OrderRecord }>(await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, serviceIds: picked, priority, referredBy, clinicalNotes, discount: discountValue }),
      }));
      onCreated(result.order);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to place the order.");
      setSaving(false);
    }
  }

  return (
    <Modal labelledBy="new-order-title" onRequestClose={() => { if (!saving) onClose(); }} className="new-order-modal">
      <div className="modal-heading">
        <div>
          <h2 id="new-order-title">New test order</h2>
          <p>Choose the patient and the tests. The invoice and sample labels are prepared for you.</p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} disabled={saving} aria-label="Close dialog"><X size={15} /></button>
      </div>
      <form className="modal-form new-order-form" onSubmit={submit} noValidate>
        <div className="form-field">
          <label htmlFor="order-patient">Patient *</label>
          <PatientSelect id="order-patient" value={patientId} onChange={setPatientId} choices={[]} status="ACTIVE" placeholder="Search by name, phone or patient ID" required />
        </div>

        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="order-priority">Priority</label>
            <select id="order-priority" value={priority} onChange={(event) => setPriority(event.target.value as "ROUTINE" | "URGENT")}>
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="order-referred">Referred by</label>
            <input id="order-referred" maxLength={120} placeholder="Doctor or hospital (optional)" value={referredBy} onChange={(event) => setReferredBy(event.target.value)} />
          </div>
        </div>

        <fieldset className="order-picker">
          <legend>Tests <span>{picked.length} selected</span></legend>
          {picked.length > 0 && (
            <ul className="order-picked" aria-label="Selected tests">
              {picked.map((id) => {
                const item = byId.get(id);
                if (!item) return null;
                return (
                  <li key={id}>
                    <span><strong>{item.name}</strong><small>{KIND_LABEL[item.kind]} · {item.code}{item.kind === "PANEL" ? ` · ${item.panelTestCount} tests` : ""}</small></span>
                    <em>{currency.format(Number(item.standardPrice))}</em>
                    <button type="button" className="icon-button" aria-label={`Remove ${item.name}`} onClick={() => setPicked((current) => current.filter((value) => value !== id))}><X size={13} /></button>
                  </li>
                );
              })}
            </ul>
          )}
          <label className="patient-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tests, packages or services" aria-label="Search the test catalog" /></label>
          {catalogError && <div className="form-error" role="alert">{catalogError}</div>}
          <div className="order-results">
            {shown.map((item) => (
              <button type="button" key={item.id} className="order-result" onClick={() => setPicked((current) => [...current, item.id])}>
                <KindIcon kind={item.kind} />
                <span><strong>{item.name}</strong><small>{item.code} · {item.category}{item.sampleType && item.kind !== "SERVICE" ? ` · ${item.sampleType}` : ""}{item.fastingRequired ? " · fasting" : ""}</small></span>
                <em>{currency.format(Number(item.standardPrice))}</em>
              </button>
            ))}
            {!shown.length && !catalogError && <p className="clinic-empty">{catalog.length ? "No match. Try another word." : "Loading the test list…"}</p>}
          </div>
        </fieldset>

        <div className="form-field">
          <label htmlFor="order-notes">Clinical notes</label>
          <textarea id="order-notes" maxLength={1000} placeholder="Symptoms or reason for the tests (optional)" value={clinicalNotes} onChange={(event) => setClinicalNotes(event.target.value)} />
        </div>

        <div className="order-totals">
          <label className="form-field">Discount (BDT)
            <input type="number" inputMode="decimal" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} />
          </label>
          <dl>
            <div><dt>Subtotal</dt><dd>{currency.format(subtotal)}</dd></div>
            {discountValue > 0 && <div><dt>Discount</dt><dd>− {currency.format(discountValue)}</dd></div>}
            <div className="order-total"><dt>Total</dt><dd>{currency.format(Math.max(total, 0))}</dd></div>
            {longestReport > 0 && <div><dt>Report ready in</dt><dd>about {longestReport >= 24 && longestReport % 24 === 0 ? `${longestReport / 24} day${longestReport === 24 ? "" : "s"}` : `${longestReport} hours`}</dd></div>}
          </dl>
        </div>

        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="modal-actions">
          <button className="button-secondary" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="button-primary" type="submit" disabled={saving || !picked.length}>{saving ? "Placing order…" : "Place order"}</button>
        </div>
      </form>
    </Modal>
  );
}
