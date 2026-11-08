"use client";

import ExportButtons from "@/modules/export/components/export-buttons";
import { useCallback, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import Modal from "@/components/shared/modal";
import { bdtCurrency } from "@/lib/format";
import { formatStatus } from "@/lib/status-labels";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import { localDate, useSectionLoader } from "@/modules/clinic/components/section-shared";

const categories = ["RENT", "UTILITIES", "SUPPLIES", "LAB_FEES", "EQUIPMENT", "SALARY", "MARKETING", "MAINTENANCE", "OTHER"] as const;
const methods = ["CASH", "CARD", "MOBILE_BANKING", "BANK_TRANSFER"] as const;

type Expense = {
  id: string;
  category: string;
  description: string;
  amount: string;
  spentAt: string;
  method: string;
  reference: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  createdBy: { id: string; name: string } | null;
};
type ExpenseList = { total: string; expenses: Expense[]; nextCursor: string | null };

const monthStart = () => `${localDate().slice(0, 7)}-01`;
const emptyForm = () => ({ category: "SUPPLIES", description: "", amount: "", spentAt: localDate(), method: "CASH", reference: "" });
const shortDate = (value: string) => new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value));

export default function ExpensesSection({ onNotice }: { onNotice: (message: string, error: boolean) => void }) {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(() => localDate());
  const [category, setCategory] = useState("");
  const [list, setList] = useState<ExpenseList>({ total: "0.00", expenses: [], nextCursor: null });
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [voiding, setVoiding] = useState<Expense | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState("");
  const [voidBusy, setVoidBusy] = useState(false);
  const rangeInvalid = from > to;

  const query = `from=${from}&to=${to}${category ? `&category=${category}` : ""}`;
  const load = useCallback(async () => {
    if (from > to) return; // the range error is shown inline; keep the last good list
    setList(await requestJson<ExpenseList>(await fetch(`/api/expenses?${query}`, { cache: "no-store" })));
  }, [from, to, query]);
  const { gate, reload } = useSectionLoader({ section: "expenses", load, shouldPauseLive: () => saving || voidBusy, softReload: true });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError("");
    try {
      await requestJson(await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount), reference: form.reference || null }),
      }));
      setForm(emptyForm());
      onNotice("Expense recorded.", false);
      reload();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to record the expense.");
    } finally {
      setSaving(false);
    }
  }

  async function loadMore() {
    if (!list.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const more = await requestJson<ExpenseList>(await fetch(`/api/expenses?${query}&cursor=${encodeURIComponent(list.nextCursor)}`, { cache: "no-store" }));
      setList((current) => ({ ...more, expenses: [...current.expenses, ...more.expenses.filter((item) => !current.expenses.some((known) => known.id === item.id))] }));
    } catch (error) {
      onNotice(error instanceof Error ? error.message : "Unable to load more expenses.", true);
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmVoid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!voiding || voidBusy) return;
    setVoidBusy(true);
    setVoidError("");
    try {
      await requestJson(await fetch(`/api/expenses/${voiding.id}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: voidReason }),
      }));
      setVoiding(null);
      setVoidReason("");
      onNotice("Expense voided.", false);
      reload();
    } catch (error) {
      setVoidError(error instanceof Error ? error.message : "Unable to void the expense.");
    } finally {
      setVoidBusy(false);
    }
  }

  if (gate) return gate;
  const activeCount = list.expenses.filter((expense) => !expense.voidedAt).length;

  return (
    <div className="clinic-module-grid expenses-grid">
      <section className="panel-card clinic-module-card">
        <header className="panel-header"><div><h2 className="panel-title">Record an expense</h2><p className="panel-description">Costs of running the clinic. Entries are never deleted; a mistaken one can be voided with a reason.</p></div></header>
        <form className="modal-form clinic-module-form" onSubmit={submit} aria-describedby={formError ? "expense-form-error" : undefined}>
          <div className="form-grid">
            <label className="form-field">Category *<select required value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select></label>
            <label className="form-field">Date *<input required type="date" max={localDate()} value={form.spentAt} onChange={(event) => setForm({ ...form, spentAt: event.target.value })} /></label>
            <label className="form-field">Amount (BDT) *<input required type="number" inputMode="decimal" min="0.01" step="0.01" max="99999999" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
            <label className="form-field">Paid by<select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>{methods.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select></label>
          </div>
          <label className="form-field">Description *<input required minLength={2} maxLength={300} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="e.g. Composite resin and bonding agent" /></label>
          <label className="form-field">Reference<input maxLength={120} value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Receipt or transaction number (optional)" /></label>
          {formError && <div className="form-error" id="expense-form-error" role="alert">{formError}</div>}
          <div className="modal-actions"><button className="button-primary" disabled={saving}><Plus size={14} />{saving ? "Saving…" : "Record expense"}</button></div>
        </form>
      </section>

      <section className="panel-card clinic-module-card">
        <header className="panel-header"><div><h2 className="panel-title">Expenses</h2><p className="panel-description">Total for the period excludes voided entries.</p></div><ExportButtons dataset="expenses" dates={{ from, to }} filters={{ category }} /></header>
        <div className="expense-toolbar">
          <label className="form-field">From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
          <label className="form-field">To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
          <label className="form-field">Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="">All categories</option>{categories.map((item) => <option key={item} value={item}>{formatStatus(item)}</option>)}</select></label>
          <div className="expense-total" aria-live="polite"><span>Total spent</span><strong>{bdtCurrency.format(Number(list.total))}</strong><small>{activeCount} active {activeCount === 1 ? "entry" : "entries"} shown</small></div>
        </div>
        {rangeInvalid && <div className="form-error" role="alert">The start date must be on or before the end date.</div>}
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Paid by</th><th className="numeric">Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>
          {list.expenses.map((expense) => (
            <tr key={expense.id} className={expense.voidedAt ? "expense-voided" : undefined}>
              <td>{shortDate(expense.spentAt)}</td>
              <td>{formatStatus(expense.category)}</td>
              <td><strong>{expense.description}</strong>{expense.reference && <div className="cell-secondary">Ref {expense.reference}</div>}{expense.voidReason && <div className="cell-secondary">Voided: {expense.voidReason}</div>}</td>
              <td>{formatStatus(expense.method)}</td>
              <td className="numeric">{bdtCurrency.format(Number(expense.amount))}</td>
              <td>{expense.voidedAt ? <span className="invoice-status invoice-status-void">Voided</span> : <span className="invoice-status invoice-status-paid">Recorded</span>}</td>
              <td>{!expense.voidedAt && <button type="button" className="request-action request-action-danger" onClick={() => { setVoiding(expense); setVoidReason(""); setVoidError(""); }}>Void</button>}</td>
            </tr>
          ))}
          {!list.expenses.length && <tr><td colSpan={7}>No expenses in this period. Record one above or widen the dates.</td></tr>}
        </tbody></table></div>
        {list.nextCursor && <div className="appointment-load-more"><button type="button" className="button-secondary" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Loading…" : "Load more"}</button></div>}
      </section>

      {voiding && (
        <Modal className="confirm-modal" labelledBy="void-expense-title" onRequestClose={() => { if (!voidBusy) setVoiding(null); }}>
          <form onSubmit={confirmVoid}>
            <div className="modal-heading">
              <div>
                <h2 id="void-expense-title">Void this expense?</h2>
                <p>{voiding.description} · {bdtCurrency.format(Number(voiding.amount))}. It stays in the list, marked as voided, and no longer counts toward totals.</p>
              </div>
              <button type="button" className="icon-button" onClick={() => setVoiding(null)} aria-label="Close dialog" disabled={voidBusy}><X size={16} /></button>
            </div>
            <label className="form-field">Reason *<input required autoFocus minLength={3} maxLength={500} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Why is this being voided?" /></label>
            {voidError && <div className="form-error" role="alert">{voidError}</div>}
            <div className="modal-actions">
              <button type="button" className="button-secondary" onClick={() => setVoiding(null)} disabled={voidBusy}>Keep expense</button>
              <button className="button-primary button-danger" disabled={voidBusy}>{voidBusy ? "Voiding…" : "Void expense"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
