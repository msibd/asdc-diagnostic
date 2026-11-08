"use client";

import ExportButtons from "@/modules/export/components/export-buttons";
import { Lock } from "lucide-react";
import { useCallback, useState, type FormEvent } from "react";
import { useAdminSession } from "@/components/shared/admin-session-provider";
import { bdtCurrency } from "@/lib/format";
import { can } from "@/lib/permissions";
import { formatStatus } from "@/lib/status-labels";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import { Metric, localDate, useSectionLoader } from "@/modules/clinic/components/section-shared";
import type { DailyFigures } from "@/modules/finance/finance-service";

type Closing = { openingCash: string; expectedCash: string; countedCash: string; difference: string; note: string | null; closedAt: string; closedBy: string | null };
type Daily = DailyFigures & { closing: Closing | null };
type ClosingRow = { id: string; businessDate: string; expectedCash: string; countedCash: string; difference: string; note: string | null; closedBy: string | null };

const money = (value: string) => bdtCurrency.format(Number(value));
const dayLabel = (value: string) => new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
const signed = (value: string) => (Number(value) > 0 ? "+" : "") + money(value);

// The day's income and expenses, and the end-of-day cash count that closes the day.
export default function CashClosing({ onNotice }: { onNotice: (message: string, error: boolean) => void }) {
  const { user } = useAdminSession();
  const canClose = can(user.permissions, "finance:close");
  const [date, setDate] = useState(() => localDate());
  const [daily, setDaily] = useState<Daily | null>(null);
  const [history, setHistory] = useState<ClosingRow[]>([]);
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [day, closings] = await Promise.all([
      requestJson<Daily>(await fetch(`/api/finance/daily?date=${date}`, { cache: "no-store" })),
      requestJson<{ closings: ClosingRow[] }>(await fetch("/api/finance/closings", { cache: "no-store" })),
    ]);
    setDaily(day);
    setHistory(closings.closings);
  }, [date]);
  const { gate, reload } = useSectionLoader({ section: "finance", load, shouldPauseLive: () => busy || counted !== "", softReload: true });

  async function close(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await requestJson(await fetch("/api/finance/closings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessDate: date, countedCash: Number(counted), note: note.trim() || null }),
      }));
      setCounted("");
      setNote("");
      onNotice(`Cash closed for ${dayLabel(date)}.`, false);
      reload();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to close the day.");
    } finally {
      setBusy(false);
    }
  }

  if (gate) return gate;
  if (!daily) return null;
  const expected = Number(daily.cash.expected);
  const difference = counted === "" ? null : Math.round((Number(counted) - expected) * 100) / 100;

  return (
    <div className="clinic-module-grid expenses-grid">
      <section className="panel-card clinic-module-card">
        <header className="panel-header"><div><h2 className="panel-title">Daily summary</h2><p className="panel-description">Money in and out on the chosen day. Refunds count on the day they were paid back.</p></div><ExportButtons dataset="cash-closings" range /></header>
        <div className="expense-toolbar">
          <label className="form-field">Day<input type="date" value={date} max={localDate()} onChange={(event) => event.target.value && setDate(event.target.value)} /></label>
        </div>
        <div className="clinic-report-cards">
          <Metric label="Income" value={money(daily.totals.income)} />
          <Metric label="Expenses" value={money(daily.totals.expenses)} />
          <Metric label={Number(daily.totals.net) < 0 ? "Loss" : "Profit"} value={money(daily.totals.net)} />
        </div>
        <h3 className="clinic-subheading">Income by payment method</h3>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Method</th><th className="numeric">Received</th><th className="numeric">Refunded</th><th className="numeric">Net</th></tr></thead><tbody>
          {daily.income.map((row) => <tr key={row.method}><td>{formatStatus(row.method)}</td><td className="numeric">{money(row.received)}</td><td className="numeric">{money(row.refunded)}</td><td className="numeric">{money(row.net)}</td></tr>)}
          {!daily.income.length && <tr><td colSpan={4}>No payments on this day.</td></tr>}
        </tbody></table></div>
        <h3 className="clinic-subheading">Expenses by category</h3>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Category</th><th className="numeric">Amount</th></tr></thead><tbody>
          {daily.expenses.map((row) => <tr key={row.category}><td>{formatStatus(row.category)}</td><td className="numeric">{money(row.amount)}</td></tr>)}
          {!daily.expenses.length && <tr><td colSpan={2}>No expenses on this day.</td></tr>}
        </tbody></table></div>
      </section>

      <section className="panel-card clinic-module-card">
        <header className="panel-header"><div><h2 className="panel-title">Cash drawer</h2><p className="panel-description">Count the cash in the drawer and close the day. Only cash payments and cash expenses are included.</p></div></header>
        <dl className="cash-lines">
          <div><dt>Opening cash{daily.previousClosing ? ` (counted ${dayLabel(daily.previousClosing.businessDate)})` : ""}</dt><dd>{money(daily.closing?.openingCash ?? daily.cash.opening)}</dd></div>
          <div><dt>+ Cash received</dt><dd>{money(daily.cash.received)}</dd></div>
          <div><dt>− Cash refunded</dt><dd>{money(daily.cash.refunded)}</dd></div>
          <div><dt>− Cash expenses</dt><dd>{money(daily.cash.expenses)}</dd></div>
          <div className="cash-total"><dt>Expected in drawer</dt><dd>{money(daily.closing?.expectedCash ?? daily.cash.expected)}</dd></div>
        </dl>
        {daily.closing ? (
          <div className="cash-closed" role="status">
            <p><Lock size={14} /> Closed {new Intl.DateTimeFormat("en", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(new Date(daily.closing.closedAt))}{daily.closing.closedBy ? ` by ${daily.closing.closedBy}` : ""}.</p>
            <p>Counted <strong>{money(daily.closing.countedCash)}</strong> · difference <strong className={Number(daily.closing.difference) === 0 ? "inventory-good" : "inventory-bad"}>{signed(daily.closing.difference)}</strong></p>
            {daily.closing.note && <p className="cell-secondary">Note: {daily.closing.note}</p>}
          </div>
        ) : canClose ? (
          <form className="modal-form" onSubmit={close}>
            <label className="form-field">Counted cash (BDT) *<input required type="number" inputMode="decimal" min="0" step="0.01" max="99999999" value={counted} onChange={(event) => setCounted(event.target.value)} /></label>
            {difference !== null && <p className={difference === 0 ? "inventory-good" : "inventory-bad"} aria-live="polite">{difference === 0 ? "Matches the expected cash." : `Difference: ${signed(String(difference))} (${difference < 0 ? "short" : "over"})`}</p>}
            <label className="form-field">Note{difference ? " *" : ""}<input maxLength={500} required={Boolean(difference)} value={note} onChange={(event) => setNote(event.target.value)} placeholder={difference ? "Explain the difference" : "Optional"} /></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <div className="modal-actions"><button className="button-primary" disabled={busy || counted === ""}><Lock size={14} /> {busy ? "Closing…" : "Close the day"}</button></div>
          </form>
        ) : <p className="cell-secondary">Only an administrator can close the day.</p>}

        <h3 className="clinic-subheading">Recent closings</h3>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Day</th><th className="numeric">Expected</th><th className="numeric">Counted</th><th className="numeric">Difference</th></tr></thead><tbody>
          {history.slice(0, 14).map((row) => (
            <tr key={row.id}><td>{dayLabel(row.businessDate)}{row.note && <div className="cell-secondary">{row.note}</div>}</td><td className="numeric">{money(row.expectedCash)}</td><td className="numeric">{money(row.countedCash)}</td><td className={`numeric ${Number(row.difference) === 0 ? "inventory-good" : "inventory-bad"}`}>{signed(row.difference)}</td></tr>
          ))}
          {!history.length && <tr><td colSpan={4}>No days closed yet.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
