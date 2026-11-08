"use client";

import ExportButtons from "@/modules/export/components/export-buttons";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState, type FormEvent } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { emptyInvoiceForm, emptyInvoiceItem, invoiceFormSchema, type InvoiceFormValues } from "@/modules/billing/billing-schema";
import { Plus, Printer, Search, Trash2 } from "lucide-react";
import { formatClinicDate } from "@/lib/clinic-date";
import PatientSelect from "@/components/shared/patient-select";
import { formatStatus, statusModifier } from "@/lib/status-labels";
import { InvoicePrintSheet, type InvoiceLetterhead } from "@/modules/clinic/components/print-sheets";
import { useAdminSession } from "@/components/shared/admin-session-provider";
import { bdtCurrency as currency } from "@/lib/format";
import { requestJson, type ServiceRecord, type PatientChoice, type InvoiceRecord } from "./clinic-types";
import { useSectionLoader, useDebouncedValue, usePrintJob, type SectionProps } from "./section-shared";

export default function BillingSection({ onNotice }: SectionProps) {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [patients, setPatients] = useState<PatientChoice[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search);
  // Same rules as the API (billing-schema.ts); the total updates as the items change.
  const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
    defaultValues: emptyInvoiceForm(),
    mode: "onTouched",
  });
  const items = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control });
  const totalCents = (watched.items ?? []).reduce((sum, item) => sum + Math.round(Number(item?.unitPrice || 0) * 100) * Number(item?.quantity || 0), 0)
    - Math.round(Number(watched.discount || 0) * 100) + Math.round(Number(watched.tax || 0) * 100);
  const [printJob, setPrintJob] = usePrintJob();
  const [letterhead, setLetterhead] = useState<InvoiceLetterhead | null>(null);
  const { user } = useAdminSession();
  const [invoiceCursor, setInvoiceCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async (needChoices: boolean) => {
    const [invoiceResult, patientResult, serviceResult] = await Promise.all([
      requestJson<{ invoices: InvoiceRecord[]; nextCursor: string | null; clinic?: InvoiceLetterhead }>(await fetch(`/api/billing?search=${encodeURIComponent(debouncedSearch)}`, { cache: "no-store" })),
      needChoices
        ? requestJson<{ patients: PatientChoice[] }>(await fetch("/api/patients?page=1&pageSize=100&status=ALL&fields=picker", { cache: "no-store" }))
        : Promise.resolve(null),
      needChoices
        ? requestJson<{ services: ServiceRecord[] }>(await fetch("/api/services", { cache: "no-store" }))
        : Promise.resolve(null),
    ]);
    setInvoices(invoiceResult.invoices);
    if (invoiceResult.clinic) setLetterhead(invoiceResult.clinic);
    setInvoiceCursor(invoiceResult.nextCursor);
    if (patientResult) setPatients(patientResult.patients);
    if (serviceResult) setServices(serviceResult.services);
  }, [debouncedSearch]);

  const { gate, reload } = useSectionLoader({ section: "billing", load, shouldPauseLive: () => saving });

  async function loadMore() {
    const cursor = invoiceCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const query = `search=${encodeURIComponent(debouncedSearch)}&cursor=${encodeURIComponent(cursor)}`;
      const result = await requestJson<{ invoices: InvoiceRecord[]; nextCursor: string | null }>(await fetch(`/api/billing?${query}`, { cache: "no-store" }));
      setInvoices((current) => {
        const known = new Set(current.map((item) => item.id));
        return [...current, ...result.invoices.filter((item) => !known.has(item.id))];
      });
      setInvoiceCursor(result.nextCursor);
    } catch (loadError) {
      onNotice(loadError instanceof Error ? loadError.message : "Unable to load more records.", true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function createInvoice(values: InvoiceFormValues) {
    setSaving(true);
    try {
      await requestJson(await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: values.patientId,
          discount: Number(values.discount),
          tax: Number(values.tax),
          notes: values.notes || null,
          items: values.items.map((item) => ({
            serviceId: item.serviceId || null,
            description: item.description,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          })),
        }),
      }));
      reset(emptyInvoiceForm());
      reload();
      onNotice("Invoice issued.", false);
    } catch (saveError) {
      onNotice(saveError instanceof Error ? saveError.message : "Unable to issue invoice.", true);
    } finally { setSaving(false); }
  }


  async function recordPayment(event: FormEvent<HTMLFormElement>, invoiceId: string) {
    event.preventDefault();
    // Block a double-click: a second submit while the first is in flight would record the payment twice.
    const submit = event.currentTarget.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!submit || submit.disabled) return;
    submit.disabled = true;
    const formData = new FormData(event.currentTarget);
    try {
      await requestJson(await fetch(`/api/billing/${invoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(formData.get("amount")),
          method: String(formData.get("method")),
          reference: String(formData.get("reference") ?? "") || null,
          note: String(formData.get("note") ?? "") || null,
        }),
      }));
      onNotice("Payment recorded.", false);
      reload();
    } catch (paymentError) {
      onNotice(paymentError instanceof Error ? paymentError.message : "Unable to record payment.", true);
    } finally { submit.disabled = false; }
  }

  async function refundPayment(event: FormEvent<HTMLFormElement>, paymentId: string) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("reason") ?? "");
    try {
      await requestJson(await fetch(`/api/billing/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }));
      onNotice("Payment refund recorded.", false);
      reload();
    } catch (refundError) {
      onNotice(refundError instanceof Error ? refundError.message : "Unable to refund payment.", true);
    }
  }

  if (gate) return gate;

  return (
    <div className="billing-page">
      {printJob?.kind === "invoice" && <InvoicePrintSheet invoice={printJob.invoice} letterhead={letterhead} printedBy={user.name} />}
      <div className="billing-content-grid">
      <section className="panel-card clinic-module-card billing-issue-card">
        <header className="panel-header billing-panel-header"><div><h2 className="panel-title">Issue invoice</h2><p className="panel-description">Financial records cannot be deleted. Record corrections through refund workflows.</p></div></header>
        <form className="modal-form clinic-module-form billing-invoice-form" noValidate onSubmit={handleSubmit(createInvoice)}>
          <label className="form-field">Patient<PatientSelect required value={watched.patientId ?? ""} choices={patients} status="ALL" placeholder="Select patient" onChange={(patientId) => setValue("patientId", patientId, { shouldValidate: true })} />{errors.patientId && <small className="field-error" role="alert">{errors.patientId.message}</small>}</label>
          <div className="billing-invoice-items">
            {items.fields.map((item, index) => {
              const itemErrors = errors.items?.[index];
              return (
                <fieldset className="clinic-medication billing-invoice-item" key={item.id}>
                  <legend>Invoice item {index + 1}</legend>
                  <div className="billing-item-grid">
                    <label className="form-field">Service
                      <select {...register(`items.${index}.serviceId`, {
                        // Picking a service fills in its name and standard price.
                        onChange: (event) => {
                          const selected = services.find((service) => service.id === event.target.value);
                          if (!selected) return;
                          setValue(`items.${index}.description`, selected.name, { shouldValidate: true });
                          setValue(`items.${index}.unitPrice`, selected.standardPrice, { shouldValidate: true });
                        },
                      })}>
                        <option value="">Custom item</option>
                        {services.map((service) => <option key={service.id} value={service.id}>{service.name} · {currency.format(Number(service.standardPrice))}</option>)}
                      </select>
                    </label>
                    <label className="form-field">Description
                      <input maxLength={200} aria-invalid={itemErrors?.description ? true : undefined} {...register(`items.${index}.description`)} />
                      {itemErrors?.description && <small className="field-error" role="alert">{itemErrors.description.message}</small>}
                    </label>
                    <label className="form-field">Quantity
                      <input type="number" min="1" max="1000" inputMode="numeric" aria-invalid={itemErrors?.quantity ? true : undefined} {...register(`items.${index}.quantity`)} />
                      {itemErrors?.quantity && <small className="field-error" role="alert">{itemErrors.quantity.message}</small>}
                    </label>
                    <label className="form-field">Unit price (BDT)
                      <input type="number" min="0" step="0.01" inputMode="decimal" aria-invalid={itemErrors?.unitPrice ? true : undefined} {...register(`items.${index}.unitPrice`)} />
                      {itemErrors?.unitPrice && <small className="field-error" role="alert">{itemErrors.unitPrice.message}</small>}
                    </label>
                  </div>
                  {items.fields.length > 1 && <button className="request-action request-action-danger" type="button" onClick={() => items.remove(index)}><Trash2 size={13} /> Remove item</button>}
                </fieldset>
              );
            })}
          </div>
          <button type="button" className="button-secondary billing-add-item" disabled={items.fields.length >= 100} onClick={() => items.append(emptyInvoiceItem())}><Plus size={14} /> Add invoice item</button>
          <div className="billing-adjustments-grid">
            <label className="form-field">Discount (BDT)<input type="number" min="0" step="0.01" inputMode="decimal" aria-invalid={errors.discount ? true : undefined} {...register("discount")} />{errors.discount && <small className="field-error" role="alert">{errors.discount.message}</small>}</label>
            <label className="form-field">Tax (BDT)<input type="number" min="0" step="0.01" inputMode="decimal" aria-invalid={errors.tax ? true : undefined} {...register("tax")} />{errors.tax && <small className="field-error" role="alert">{errors.tax.message}</small>}</label>
          </div>
          <label className="form-field">Notes<textarea maxLength={2000} {...register("notes")} />{errors.notes && <small className="field-error" role="alert">{errors.notes.message}</small>}</label>
          <p className="m-0 text-right text-sm font-semibold text-ink-1" aria-live="polite">Total {currency.format(Math.max(0, totalCents) / 100)}</p>
          <button className="button-primary billing-issue-button" disabled={saving || !patients.length}><Plus size={14} />{saving ? "Issuing…" : "Issue invoice"}</button>
        </form>
      </section>
      <section className="panel-card clinic-module-card billing-invoices-card">
        <header className="panel-header"><div><h2 className="panel-title">Invoices and payments</h2><p className="panel-description">Partial collection, payment method tracking and audited refunds.</p></div><ExportButtons dataset="payments" range /></header>
        <label className="patient-search billing-invoice-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice, patient or ID" /></label>
        {invoices.map((invoice) => {
          const paid = invoice.payments.filter((payment) => payment.status === "POSTED").reduce((sum, payment) => sum + Number(payment.amount), 0);
          const balance = Math.max(0, Number(invoice.total) - paid);
          return <article className="clinic-record billing-invoice-record" key={invoice.id}><div className="clinic-record-heading"><strong>{invoice.invoiceCode} · {invoice.patient.name}</strong><div className="invoice-heading-meta"><span>{formatClinicDate(invoice.issuedAt)}</span><span className={`invoice-status invoice-status-${statusModifier(invoice.status)}`}>{formatStatus(invoice.status)}</span></div></div><p>{invoice.items.map((item) => `${item.description} × ${item.quantity}`).join(", ")}</p><p>Total {currency.format(Number(invoice.total))} · Paid {currency.format(paid)} · Due {currency.format(balance)}</p><div className="clinic-record-actions">{balance > 0 && invoice.status !== "VOID" && <details className="clinic-inline-details"><summary>Record payment</summary><form className="clinic-inline-form" onSubmit={(event) => void recordPayment(event, invoice.id)}><label>Amount (up to {currency.format(balance)})<input name="amount" type="number" inputMode="decimal" min="0.01" max={balance.toFixed(2)} step="0.01" required /></label><label>Method<select name="method" defaultValue="CASH"><option value="CASH">Cash</option><option value="CARD">Card</option><option value="MOBILE_BANKING">Mobile banking</option><option value="BANK_TRANSFER">Bank transfer</option></select></label><label>Reference<input name="reference" maxLength={120} /></label><label>Note<input name="note" maxLength={1000} /></label><button className="button-primary" type="submit">Save payment</button></form></details>}{invoice.status !== "VOID" && !invoice.payments.length && <details className="clinic-inline-details"><summary>Void invoice</summary><form className="clinic-inline-form" onSubmit={async (event) => { event.preventDefault(); const reason = String(new FormData(event.currentTarget).get("reason") ?? ""); try { await requestJson(await fetch(`/api/billing/${invoice.id}/void`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) })); onNotice("Invoice voided with an audit reason.", false); reload(); } catch (voidError) { onNotice(voidError instanceof Error ? voidError.message : "Unable to void invoice.", true); } }}><label>Reason<input name="reason" minLength={3} maxLength={500} required /></label><button className="button-secondary" type="submit">Confirm void</button></form></details>}<button className="request-action" onClick={() => setPrintJob({ kind: "invoice", invoice })}><Printer size={13} /> Print</button></div>{invoice.payments.filter((payment) => payment.status === "POSTED").map((payment) => <details className="clinic-inline-details" key={payment.id}><summary>Refund {currency.format(Number(payment.amount))}</summary><form className="clinic-inline-form" onSubmit={(event) => void refundPayment(event, payment.id)}><label>Reason<input name="reason" minLength={3} maxLength={500} required /></label><button className="button-secondary" type="submit">Record full refund</button></form></details>)}</article>;
        })}
        {!invoices.length && <p className="clinic-empty">No invoices found.</p>}
        {invoiceCursor && (
          <div className="appointment-load-more">
            <button type="button" className="button-secondary" disabled={loadingMore} onClick={() => void loadMore()}>
              {loadingMore ? "Loading invoices…" : `Load older invoices (${invoices.length} shown)`}
            </button>
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
