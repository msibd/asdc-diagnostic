"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Copy, ExternalLink, Mail, MessageSquare, Send, Undo2 } from "lucide-react";
import { formatClinicDate, formatClinicTime } from "@/lib/clinic-date";
import { bdtCurrency as currency } from "@/lib/format";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import type { OrderRecord } from "./order-types";

type History = { id: string; reportCode: string; version: number; status: "ISSUED" | "WITHDRAWN"; issuedAt: string; issuedBy: string; withdrawnAt: string | null; withdrawnBy: string | null; withdrawReason: string | null };
type ReportView = {
  status: string;
  due: string;
  pinHint: boolean;
  canEmail: boolean;
  preview: { hasCritical: boolean } | null;
  report: null | { id: string; reportCode: string; version: number; issuedAt: string; issuedBy: string; link: string; smsSentAt: string | null; emailSentAt: string | null; firstViewedAt: string | null; viewCount: number; snapshot: { hasCritical: boolean } };
  history: History[];
};

const when = (iso: string) => `${formatClinicDate(iso)} ${formatClinicTime(iso)}`;

/**
 * Release a verified report to the patient, hand it over (print, SMS, e-mail) and, if a mistake turns
 * up later, withdraw it so it can be corrected and released again.
 */
export default function OrderReportPanel({ order, canRelease, canSend, onOrderChange }: {
  order: OrderRecord;
  canRelease: boolean;
  canSend: boolean;
  onOrderChange: (order: OrderRecord) => void;
}) {
  const [view, setView] = useState<ReportView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${order.id}/report`, { cache: "no-store" })
      .then((response) => requestJson<ReportView>(response))
      .then((result) => { if (!cancelled) { setView(result); setLoadError(""); } })
      .catch((reportError) => { if (!cancelled) setLoadError(reportError instanceof Error ? reportError.message : "Unable to load the report."); });
    return () => { cancelled = true; };
  }, [order.id, order.status]);

  async function act(key: string, body: Record<string, unknown>, done?: () => void) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      const next = await requestJson<ReportView>(await fetch(`/api/orders/${order.id}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
      setView(next);
      // The order's own status changed (verified <-> released), so refresh it for the list and dialog.
      const fresh = await requestJson<{ order: OrderRecord }>(await fetch(`/api/orders/${order.id}`, { cache: "no-store" }));
      onOrderChange(fresh.order);
      done?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  async function sendLink(channel: "sms" | "email") {
    setBusy(`send:${channel}`);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/orders/${order.id}/report/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }) });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; message?: string; error?: string; view?: ReportView };
      if (result.view) setView(result.view);
      if (response.ok && result.ok) setNotice(channel === "sms" ? "SMS sent to the patient." : "E-mail sent to the patient.");
      else setError(result.message ?? result.error ?? "It could not be sent.");
    } catch {
      setError("It could not be sent. Check the connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Link copied. The patient also needs the last 4 digits of their phone number.");
      setError("");
    } catch {
      setError("The link could not be copied. Select and copy it by hand.");
    }
  }

  if (loadError) return <div className="form-error" role="alert">{loadError}</div>;
  if (!view) return <p className="clinic-empty">Loading the report…</p>;

  const { report } = view;
  const owes = Number(view.due) > 0;
  const critical = report?.snapshot.hasCritical ?? view.preview?.hasCritical ?? false;

  return (
    <div className="report-panel">
      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="report-notice" role="status">{notice}</div>}

      {!report && view.status === "VERIFIED" && (
        <div className="report-card">
          <p><strong>Every test is approved.</strong> Release the report so the patient can have it.</p>
          {owes && <p className="report-warning"><AlertTriangle size={14} aria-hidden /> {currency.format(Number(view.due))} is still unpaid on this order.</p>}
          {critical && <p className="report-warning"><AlertTriangle size={14} aria-hidden /> This report has a critical result. Make sure the doctor or patient has been told.</p>}
          <div className="report-actions">
            <Link className="button-secondary" href={`/orders/${order.id}/report`} target="_blank"><ExternalLink size={14} /> Preview report</Link>
            {canRelease && <button type="button" className="button-primary" disabled={busy !== null} onClick={() => act("release", { action: "release" })}><Send size={14} /> {busy === "release" ? "Releasing…" : "Release report"}</button>}
          </div>
          {!canRelease && <small>Only the pathologist can release the report.</small>}
        </div>
      )}

      {report && (
        <div className="report-card report-card-issued">
          <div className="report-issued-head">
            <div>
              <strong>{report.reportCode}</strong>{report.version > 1 && <span className="report-version"> · version {report.version}</span>}
              <small>Released {when(report.issuedAt)} by {report.issuedBy}</small>
            </div>
            <Link className="button-primary" href={`/orders/${order.id}/report`} target="_blank"><ExternalLink size={14} /> Open / print report</Link>
          </div>
          {owes && <p className="report-warning"><AlertTriangle size={14} aria-hidden /> {currency.format(Number(view.due))} is still unpaid on this order.</p>}
          {critical && <p className="report-warning"><AlertTriangle size={14} aria-hidden /> This report has a critical result.</p>}

          <div className="report-actions">
            <button type="button" className="button-secondary" onClick={() => copyLink(report.link)}><Copy size={14} /> Copy patient link</button>
            {canSend && <button type="button" className="button-secondary" disabled={busy !== null || !view.pinHint} onClick={() => sendLink("sms")}><MessageSquare size={14} /> {busy === "send:sms" ? "Sending…" : report.smsSentAt ? "Send SMS again" : "Send SMS"}</button>}
            {canSend && <button type="button" className="button-secondary" disabled={busy !== null || !view.pinHint || !view.canEmail} title={view.canEmail ? undefined : "No e-mail address on file"} onClick={() => sendLink("email")}><Mail size={14} /> {busy === "send:email" ? "Sending…" : report.emailSentAt ? "Send e-mail again" : "Send e-mail"}</button>}
          </div>

          <ul className="report-delivery">
            <li>{report.smsSentAt ? `SMS sent ${when(report.smsSentAt)}` : "SMS not sent"}</li>
            <li>{report.emailSentAt ? `E-mail sent ${when(report.emailSentAt)}` : view.canEmail ? "E-mail not sent" : "No e-mail address on file"}</li>
            <li>{report.viewCount ? `Opened online ${report.viewCount} time${report.viewCount > 1 ? "s" : ""}${report.firstViewedAt ? `, first ${when(report.firstViewedAt)}` : ""}` : "Not yet opened online"}</li>
          </ul>
          <small>{view.pinHint ? "The patient opens the link with a PIN: the last 4 digits of their phone number." : "This patient's phone number is too short to make a PIN, so the report cannot be opened online. Print it instead."}</small>

          {canRelease && !withdrawing && (
            <button type="button" className="button-secondary report-withdraw" onClick={() => { setWithdrawing(true); setReason(""); }}><Undo2 size={14} /> Withdraw report…</button>
          )}
          {withdrawing && (
            <div className="order-inline-form">
              <input aria-label="Why is the report withdrawn?" autoFocus maxLength={500} placeholder="Reason, e.g. a wrong result was entered" value={reason} onChange={(event) => setReason(event.target.value)} />
              <button type="button" className="button-primary" disabled={busy !== null || reason.trim().length < 3} onClick={() => act("withdraw", { action: "withdraw", reason }, () => { setWithdrawing(false); setReason(""); })}>{busy === "withdraw" ? "Withdrawing…" : "Withdraw"}</button>
              <button type="button" className="button-secondary" onClick={() => setWithdrawing(false)}>Keep report</button>
            </div>
          )}
        </div>
      )}

      {view.history.some((entry) => entry.status === "WITHDRAWN") && (
        <details className="report-history">
          <summary>Earlier versions ({view.history.filter((entry) => entry.status === "WITHDRAWN").length} withdrawn)</summary>
          <ul>
            {view.history.filter((entry) => entry.status === "WITHDRAWN").map((entry) => (
              <li key={entry.id}><strong>{entry.reportCode}</strong> (version {entry.version}) was withdrawn{entry.withdrawnAt ? ` ${when(entry.withdrawnAt)}` : ""}{entry.withdrawnBy ? ` by ${entry.withdrawnBy}` : ""}: {entry.withdrawReason}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
