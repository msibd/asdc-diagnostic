import { BRAND_NAME } from "@/lib/brand";
import { bdtCurrency as currency } from "@/lib/format";
import { formatClinicDate, formatClinicTime } from "@/lib/clinic-date";
import SampleBarcode from "./sample-barcode";
import { ageText, SEX_LABEL, type OrderRecord } from "./order-types";

// Print-only documents, shown by the .print-sheet rules in globals.css while mounted.

const who = (order: OrderRecord) => [ageText(order.patient.dateOfBirth), order.patient.sex ? SEX_LABEL[order.patient.sex] : ""].filter(Boolean).join(" · ");

/** One label per sample: barcode, who it belongs to, and which tests it is for. */
export function SampleLabelsSheet({ order }: { order: OrderRecord }) {
  const samples = order.samples.filter((sample) => sample.status !== "REJECTED");
  return (
    <article className="print-sheet sample-labels-sheet" lang="en">
      {samples.map((sample) => {
        const tests = order.items.filter((item) => item.sampleId === sample.id).map((item) => item.testCode);
        return (
          <section className="sample-label" key={sample.id}>
            <div className="sample-label-top">
              <strong>{order.patient.name}</strong>
              {order.priority === "URGENT" && <span className="sample-label-urgent">URGENT</span>}
            </div>
            <div className="sample-label-meta">{order.patient.patientCode}{who(order) ? ` · ${who(order)}` : ""}</div>
            <SampleBarcode value={sample.sampleCode} height={38} width={1.6} />
            <div className="sample-label-code">{sample.sampleCode}</div>
            <div className="sample-label-meta"><b>{sample.sampleType}</b> · {tests.join(", ")}</div>
            <div className="sample-label-meta">{order.orderCode} · {formatClinicDate(order.orderedAt)}</div>
          </section>
        );
      })}
      {!samples.length && <p>This order needs no sample, so there is nothing to label.</p>}
    </article>
  );
}

/** The patient's copy: what was ordered, the samples, and what is owed. */
export function OrderSlipSheet({ order }: { order: OrderRecord }) {
  return (
    <article className="print-sheet" lang="en">
      <header className="print-sheet-header">
        <div>
          <strong>{BRAND_NAME}</strong>
          <span>Test order</span>
        </div>
        <span>{order.orderCode}</span>
      </header>
      <dl className="print-sheet-meta">
        <div><dt>Patient</dt><dd>{order.patient.name}</dd></div>
        <div><dt>Patient ID</dt><dd>{order.patient.patientCode}</dd></div>
        <div><dt>Phone</dt><dd>{order.patient.phone}</dd></div>
        {who(order) && <div><dt>Age / sex</dt><dd>{who(order)}</dd></div>}
        <div><dt>Ordered</dt><dd>{formatClinicDate(order.orderedAt)} {formatClinicTime(order.orderedAt)}</dd></div>
        <div><dt>Priority</dt><dd>{order.priority === "URGENT" ? "Urgent" : "Routine"}</dd></div>
        {order.referredBy && <div><dt>Referred by</dt><dd>{order.referredBy}</dd></div>}
      </dl>
      <table className="print-sheet-table">
        <thead><tr><th>Test</th><th>Code</th><th>Sample</th></tr></thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td>{item.testName}{item.panel ? ` (${item.panel.name})` : ""}</td>
              <td>{item.testCode}</td>
              <td>{item.sampleType ?? "None"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {order.invoice && (
        <dl className="print-sheet-totals">
          <div><dt>Invoice</dt><dd>{order.invoice.invoiceCode}</dd></div>
          {Number(order.invoice.discount) > 0 && <div><dt>Discount</dt><dd>{currency.format(Number(order.invoice.discount))}</dd></div>}
          <div><dt>Total</dt><dd>{currency.format(Number(order.invoice.total))}</dd></div>
          <div><dt>Paid</dt><dd>{currency.format(Number(order.invoice.paid))}</dd></div>
          <div><dt>Due</dt><dd>{currency.format(Number(order.invoice.due))}</dd></div>
        </dl>
      )}
      {order.samples.filter((sample) => sample.status !== "REJECTED").length > 0 && (
        <p>Sample codes: {order.samples.filter((sample) => sample.status !== "REJECTED").map((sample) => `${sample.sampleCode} (${sample.sampleType})`).join(", ")}</p>
      )}
      <p>Please keep this slip. Bring it when you collect your report.</p>
    </article>
  );
}
