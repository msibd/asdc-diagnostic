import { formatClinicDate, formatClinicDateTime } from "@/lib/clinic-date";
import { ageLabel, bdtCurrency as currency, takaInWords } from "@/lib/format";
import SampleBarcode from "@/modules/orders/components/sample-barcode";

// Print-only documents. They are hidden on screen and, while mounted, are the only thing the
// browser prints (see the @media print rules in globals.css).

export type PrintableInvoice = {
  invoiceCode: string;
  status: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  issuedAt: string;
  notes?: string | null;
  /** The referring doctor as written on the request slip (from the test order, when there is one). */
  referredBy?: string | null;
  patient: { name: string; patientCode: string; phone: string; dateOfBirth?: string | null; sex?: string | null };
  items: { id: string; description: string; quantity: number; unitPrice: string; amount: string; code?: string | null; turnaroundHours?: number | null }[];
  payments: { id: string; amount: string; method: string; status: string; receivedAt: string }[];
};

/** The centre's name and contact lines at the top and bottom of a printed invoice. */
export type InvoiceLetterhead = { clinicName: string; subtitle: string; address: string | null; phone: string | null; email: string | null };

// The line printed at the foot of every invoice. Change it here to match the centre's own policy.
const INVOICE_FOOTER_NOTE = "বি: দ্র: ডেলিভারী তারিখ হতে ৩০ দিনের মধ্যে রিপোর্ট সংগ্রহ করা যাবে।";

const STAMPS: Record<string, string> = { PAID: "PAID", PARTIALLY_PAID: "PART PAID", VOID: "VOID" };
const SEX_LABEL: Record<string, string> = { MALE: "Male", FEMALE: "Female", OTHER: "Other" };

const money = (value: number) => value.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function InvoicePrintSheet({ invoice, letterhead, printedBy }: { invoice: PrintableInvoice; letterhead: InvoiceLetterhead | null; printedBy?: string }) {
  const posted = invoice.payments.filter((payment) => payment.status === "POSTED");
  const paid = posted.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const total = Number(invoice.total);
  const due = Math.max(0, total - paid);
  const discount = Number(invoice.discount);
  const tax = Number(invoice.tax);
  const stamp = STAMPS[invoice.status];
  // When the report is ready: the longest turnaround among the tests, counted from the invoice time.
  const hours = Math.max(0, ...invoice.items.map((item) => item.turnaroundHours ?? 0));
  const reportAt = hours > 0 ? new Date(new Date(invoice.issuedAt).getTime() + hours * 3_600_000) : null;
  const age = invoice.patient.dateOfBirth ? ageLabel(invoice.patient.dateOfBirth, invoice.issuedAt) : "";
  const contact = [letterhead?.address, letterhead?.phone && `Phone: ${letterhead.phone}`, letterhead?.email && `E-mail: ${letterhead.email}`].filter(Boolean).join(" · ");

  return (
    <article className="print-sheet invoice-sheet" lang="en">
      <header className="inv-head">
        <h1>{letterhead?.clinicName ?? "Invoice"}</h1>
        {letterhead?.subtitle && <p>{letterhead.subtitle}</p>}
      </header>

      <div className="inv-title">
        <strong>Invoice</strong>
        <SampleBarcode value={invoice.invoiceCode} height={30} width={1.4} />
      </div>

      <dl className="inv-grid">
        <div><dt>Pt Reg No</dt><dd>{invoice.patient.patientCode}</dd></div>
        <div><dt>Inv Date &amp; Time</dt><dd>{formatClinicDateTime(invoice.issuedAt)}</dd></div>
        <div><dt>Invoice No</dt><dd><strong>{invoice.invoiceCode}</strong></dd></div>
        <div><dt>Invoice Note</dt><dd>{invoice.notes?.trim() || ""}</dd></div>
      </dl>

      <dl className="inv-grid inv-patient">
        <div className="inv-wide"><dt>Patient Name</dt><dd><strong>{invoice.patient.name}</strong></dd></div>
        <div><dt>Mob No</dt><dd><strong>{invoice.patient.phone}</strong></dd></div>
        <div><dt>Patient Age</dt><dd>{age}</dd></div>
        <div><dt>Patient Sex</dt><dd>{invoice.patient.sex ? SEX_LABEL[invoice.patient.sex] ?? "" : ""}</dd></div>
        <div className="inv-full"><dt>Ref/Consult Dr.</dt><dd>{invoice.referredBy?.trim() || ""}</dd></div>
      </dl>

      <table className="inv-items">
        <thead><tr><th className="inv-code">Code</th><th>Name of Test</th><th className="inv-num">Test Price</th><th className="inv-num">Amount</th></tr></thead>
        <tbody>
          {invoice.items.map((item) => (
            <tr key={item.id}>
              <td className="inv-code">{item.code ?? ""}</td>
              <td>{item.description}{item.quantity > 1 ? ` × ${item.quantity}` : ""}</td>
              <td className="inv-num">{money(Number(item.unitPrice))}</td>
              <td className="inv-num">{money(Number(item.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="inv-summary">
        <div className="inv-left">
          {reportAt && <p><strong>Report Delivery :</strong> {formatClinicDateTime(reportAt)}</p>}
          {stamp && <span className={`inv-stamp${invoice.status === "VOID" ? " is-void" : ""}`}>{stamp}</span>}
        </div>
        <table className="inv-totals">
          <tbody>
            <tr><th>Total Amount</th><td>{money(Number(invoice.subtotal))}</td></tr>
            {discount > 0 && <tr><th>Less</th><td>{money(discount)}</td></tr>}
            {tax > 0 && <tr><th>Tax</th><td>{money(tax)}</td></tr>}
            <tr><th>Net Total</th><td>{money(total)}</td></tr>
            <tr><th>Received Amount</th><td>{money(paid)}</td></tr>
            <tr className="inv-due"><th>Due Amount</th><td>{money(due)}</td></tr>
          </tbody>
        </table>
      </div>

      <p className="inv-words">In Words: ({takaInWords(total)})</p>
      <div className="inv-sign">
        {printedBy && <span>Posted By :- <strong>{printedBy}</strong></span>}
        <span>Date: {formatClinicDate(invoice.issuedAt)}</span>
      </div>
      <p className="inv-remarks"><strong>Remarks :</strong></p>
      <p className="inv-footnote" lang="bn">{INVOICE_FOOTER_NOTE}</p>
      {contact && <footer className="inv-foot">{contact}</footer>}
      <span className="sr-only">{currency.format(total)}</span>
    </article>
  );
}
