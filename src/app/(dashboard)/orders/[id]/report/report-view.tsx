"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import ReportDocument from "@/modules/orders/components/report-document";
import type { ReportSnapshot } from "@/modules/orders/services/report-rules";

type View = {
  orderCode: string;
  status: string;
  preview: ReportSnapshot | null;
  report: { reportCode: string; version: number; issuedAt: string; verifyCode: string; verifyUrl: string; snapshot: ReportSnapshot } | null;
};

export default function ReportView({ orderId }: { orderId: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/orders/${orderId}/report`, { cache: "no-store" })
      .then((response) => requestJson<View>(response))
      .then((result) => { if (!cancelled) setView(result); })
      .catch((loadError) => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load the report."); });
    return () => { cancelled = true; };
  }, [orderId]);

  const snapshot = view?.report?.snapshot ?? view?.preview ?? null;

  return (
    <div className="main-area">
    <div className="content report-page">
      <div className="report-toolbar">
        <Link className="button-secondary" href="/orders"><ArrowLeft size={14} /> Back to orders</Link>
        {snapshot && <button type="button" className="button-primary" onClick={() => window.print()}><Printer size={14} /> Print / Save as PDF</button>}
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      {!view && !error && <p className="loading-state" role="status">Loading the report…</p>}
      {view && !snapshot && <div className="form-error" role="status">There is no report to show yet. A report can be made once the pathologist has approved every test.</div>}
      {view && snapshot && (
        <ReportDocument
          snapshot={snapshot}
          reportCode={view.report?.reportCode ?? null}
          version={view.report?.version ?? null}
          issuedAt={view.report?.issuedAt ?? null}
          verifyCode={view.report?.verifyCode ?? null}
          verifyUrl={view.report?.verifyUrl ?? null}
          preview={!view.report}
        />
      )}
    </div>
    </div>
  );
}
