"use client";

import { useState } from "react";
import Link from "next/link";
import { Barcode, Printer, X } from "lucide-react";
import Modal from "@/components/shared/modal";
import { bdtCurrency as currency } from "@/lib/format";
import { formatClinicDate, formatClinicTime } from "@/lib/clinic-date";
import { requestJson } from "@/modules/clinic/components/clinic-types";
import OrderReportPanel from "./order-report-panel";
import OrderResultsPanel from "./order-results-panel";
import SampleBarcode from "./sample-barcode";
import { ageText, SAMPLE_LABEL, SEX_LABEL, STATUS_LABEL, type OrderRecord, type OrderSample } from "./order-types";

type Pending = { sampleId: string; action: "collect" | "receive" | "reject" } | "cancel" | null;

export default function OrderDetailsDialog({ order, canOrders, canSamples, canEnter, canVerify, canRelease, canSend, onClose, onChange, onPrint }: {
  order: OrderRecord;
  canOrders: boolean;
  canSamples: boolean;
  canEnter: boolean;
  canVerify: boolean;
  canRelease: boolean;
  canSend: boolean;
  onClose: () => void;
  /** Called with the fresh order after every change so the list behind the dialog stays current. */
  onChange: (order: OrderRecord) => void;
  onPrint: (kind: "labels" | "slip") => void;
}) {
  const [busy, setBusy] = useState<Pending>(null);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const closed = order.status === "CANCELLED";
  const sampleStage = ["ORDERED", "SAMPLE_COLLECTED", "RECEIVED"].includes(order.status);
  const live = order.samples.filter((sample) => sample.status !== "REJECTED");

  async function run(pending: NonNullable<Pending>, request: () => Promise<Response>, done?: () => void) {
    setBusy(pending);
    setError("");
    try {
      const result = await requestJson<{ order: OrderRecord }>(await request());
      onChange(result.order);
      done?.();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  }

  const act = (sample: OrderSample, action: "collect" | "receive" | "reject") => run(
    { sampleId: sample.id, action },
    () => fetch(`/api/samples/${sample.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "reject" ? { action, reason } : { action }) }),
    () => { setRejecting(null); setReason(""); },
  );

  const cancel = () => run("cancel", () => fetch(`/api/orders/${order.id}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) }), () => { setCancelling(false); setReason(""); });

  const patientLine = [order.patient.patientCode, order.patient.phone, ageText(order.patient.dateOfBirth), order.patient.sex ? SEX_LABEL[order.patient.sex] : ""].filter(Boolean).join(" · ");

  return (
    <Modal labelledBy="order-details-title" onRequestClose={onClose} className="order-details-modal">
      <div className="modal-heading">
        <div>
          <h2 id="order-details-title">{order.orderCode} <span className={`order-status order-status-${order.status.toLowerCase().replaceAll("_", "-")}`}>{STATUS_LABEL[order.status]}</span>{order.priority === "URGENT" && <span className="order-urgent">Urgent</span>}</h2>
          <p><strong>{order.patient.name}</strong> · {patientLine}</p>
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><X size={15} /></button>
      </div>

      <div className="order-details">
        {error && <div className="form-error" role="alert">{error}</div>}
        {closed && <div className="form-error" role="status">Cancelled{order.cancelReason ? `: ${order.cancelReason}` : ""}</div>}

        <dl className="order-facts">
          <div><dt>Ordered</dt><dd>{formatClinicDate(order.orderedAt)} {formatClinicTime(order.orderedAt)}</dd></div>
          {order.referredBy && <div><dt>Referred by</dt><dd>{order.referredBy}</dd></div>}
          {order.invoice && <div><dt>Invoice</dt><dd>{order.invoice.invoiceCode} · {order.invoice.status.replaceAll("_", " ").toLowerCase()}</dd></div>}
          {order.invoice && <div><dt>Total / due</dt><dd>{currency.format(Number(order.invoice.total))} / <strong>{currency.format(Number(order.invoice.due))}</strong></dd></div>}
        </dl>
        {order.clinicalNotes && <p className="order-notes"><strong>Clinical notes:</strong> {order.clinicalNotes}</p>}

        <h3 className="order-heading">Samples</h3>
        {!order.samples.length && <p className="clinic-empty">No sample is needed for this order.</p>}
        <ul className="order-samples">
          {order.samples.map((sample) => {
            const tests = order.items.filter((item) => item.sampleId === sample.id);
            const isRejecting = rejecting === sample.id;
            return (
              <li key={sample.id} className={`order-sample order-sample-${sample.status.toLowerCase()}`}>
                <div className="order-sample-barcode">
                  <SampleBarcode value={sample.sampleCode} height={34} width={1.6} />
                  <strong>{sample.sampleCode}</strong>
                </div>
                <div className="order-sample-info">
                  <div><strong>{sample.sampleType}</strong> <span className={`sample-status sample-status-${sample.status.toLowerCase()}`}>{SAMPLE_LABEL[sample.status]}</span></div>
                  <small>{tests.length ? tests.map((item) => item.testCode).join(", ") : "Rejected sample"}</small>
                  <small>
                    {sample.collectedAt && <>Collected {formatClinicTime(sample.collectedAt)} by {sample.collectedBy ?? "staff"}. </>}
                    {sample.receivedAt && <>Received {formatClinicTime(sample.receivedAt)}. </>}
                    {sample.status === "REJECTED" && <>Rejected: {sample.rejectReason}. A replacement was requested.</>}
                  </small>
                  {isRejecting && (
                    <div className="order-inline-form">
                      <input aria-label="Why is the sample rejected?" autoFocus maxLength={500} placeholder="Reason, e.g. haemolysed or too little blood" value={reason} onChange={(event) => setReason(event.target.value)} />
                      <button type="button" className="button-primary" disabled={busy !== null || reason.trim().length < 3} onClick={() => act(sample, "reject")}>Reject</button>
                      <button type="button" className="button-secondary" onClick={() => { setRejecting(null); setReason(""); }}>Keep</button>
                    </div>
                  )}
                </div>
                {canSamples && sampleStage && !closed && !isRejecting && (
                  <div className="order-sample-actions">
                    {sample.status === "PENDING" && <button type="button" className="button-primary" disabled={busy !== null} onClick={() => act(sample, "collect")}>Mark collected</button>}
                    {sample.status === "COLLECTED" && <button type="button" className="button-primary" disabled={busy !== null} onClick={() => act(sample, "receive")}>Receive in lab</button>}
                    {(sample.status === "COLLECTED" || sample.status === "RECEIVED") && <button type="button" className="button-secondary" disabled={busy !== null} onClick={() => { setRejecting(sample.id); setReason(""); }}>Reject…</button>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {["RECEIVED", "IN_PROCESS", "RESULT_ENTERED", "VERIFIED", "DELIVERED"].includes(order.status) ? (
          <>
            <h3 className="order-heading">Results</h3>
            <OrderResultsPanel order={order} canEnter={canEnter} canVerify={canVerify} onOrderChange={onChange} />
            {["VERIFIED", "DELIVERED"].includes(order.status) && (
              <>
                <h3 className="order-heading">Report</h3>
                <OrderReportPanel order={order} canRelease={canRelease} canSend={canSend} onOrderChange={onChange} />
              </>
            )}
          </>
        ) : !closed && <p className="clinic-empty">Results can be entered once every sample has reached the lab.</p>}

        <h3 className="order-heading">Tests ({order.items.length})</h3>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Test</th><th>Sample</th><th>Part of</th></tr></thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}><td><strong>{item.testName}</strong><div className="cell-secondary">{item.testCode}</div></td><td>{item.sampleType ?? "None"}</td><td>{item.panel?.name ?? "—"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        {cancelling && (
          <div className="order-inline-form order-cancel-form">
            <input aria-label="Why is the order cancelled?" autoFocus maxLength={500} placeholder="Reason for cancelling" value={reason} onChange={(event) => setReason(event.target.value)} />
            <button type="button" className="button-primary" disabled={busy !== null || reason.trim().length < 3} onClick={cancel}>{busy === "cancel" ? "Cancelling…" : "Cancel order"}</button>
            <button type="button" className="button-secondary" onClick={() => { setCancelling(false); setReason(""); }}>Keep order</button>
          </div>
        )}
      </div>

      <div className="order-details-footer">
        <div className="order-footer-group">
          <button type="button" className="button-secondary" onClick={() => onPrint("labels")} disabled={!live.length}><Barcode size={14} /> Print labels</button>
          <button type="button" className="button-secondary" onClick={() => onPrint("slip")}><Printer size={14} /> Print slip</button>
          {order.invoice && Number(order.invoice.due) > 0 && !closed && <Link className="button-secondary" href="/billing">Take payment</Link>}
        </div>
        {canOrders && sampleStage && !cancelling && <button type="button" className="button-secondary order-cancel-button" onClick={() => { setCancelling(true); setReason(""); }}>Cancel order…</button>}
      </div>
    </Modal>
  );
}
