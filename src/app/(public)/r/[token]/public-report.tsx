"use client";

import { useState, type FormEvent } from "react";
import { LockKeyhole, Printer } from "lucide-react";
import ReportDocument from "@/modules/orders/components/report-document";
import type { ReportSnapshot } from "@/modules/orders/services/report-rules";

type Opened = { reportCode: string; version: number; issuedAt: string; verifyCode: string; verifyUrl: string; snapshot: ReportSnapshot };

/** Asks for the PIN, then shows the report. The PIN is never put in the address bar or stored. */
export default function PublicReport({ token }: { token: string }) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [withdrawn, setWithdrawn] = useState(false);
  const [report, setReport] = useState<Opened | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/public_website/api/reports/${encodeURIComponent(token)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }), cache: "no-store",
      });
      const body = await response.json().catch(() => ({})) as { report?: Opened; error?: string; withdrawn?: boolean };
      if (response.ok && body.report) { setReport(body.report); setPin(""); return; }
      setWithdrawn(Boolean(body.withdrawn));
      setError(body.error ?? "The report could not be opened.");
    } catch {
      setError("The report could not be opened. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (report) {
    return (
      <main className="lab-report-page">
        <div className="report-toolbar">
          <button type="button" className="button-primary" onClick={() => window.print()}><Printer size={14} /> Print / Save as PDF</button>
        </div>
        <ReportDocument snapshot={report.snapshot} reportCode={report.reportCode} version={report.version} issuedAt={report.issuedAt} verifyCode={report.verifyCode} verifyUrl={report.verifyUrl} />
      </main>
    );
  }

  return (
    <main className="lab-report-page lab-report-gate">
      <form className="lab-report-pin" onSubmit={submit} noValidate>
        <LockKeyhole size={28} aria-hidden />
        <h1>Your lab report</h1>
        <p>To protect your privacy, enter the <strong>last 4 digits of the mobile number</strong> you gave the laboratory.</p>
        {!withdrawn && (
          <label className="form-field">PIN
            <input value={pin} onChange={(event) => setPin(event.target.value)} inputMode="numeric" autoComplete="off" autoFocus maxLength={12} placeholder="••••" aria-invalid={error ? true : undefined} aria-describedby={error ? "pin-error" : undefined} />
          </label>
        )}
        {error && <div className="form-error" id="pin-error" role="alert">{error}</div>}
        {!withdrawn && <button className="button-primary" type="submit" disabled={busy || !pin.trim()}>{busy ? "Opening…" : "View report"}</button>}
      </form>
    </main>
  );
}
