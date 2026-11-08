import { formatClinicDate, formatClinicTime } from "@/lib/clinic-date";
import { SEX_LABEL } from "./order-types";
import QrCode from "./qr-code";
import { flagMark, formatVerifyCode, type ReportSnapshot, type SnapshotTest } from "@/modules/orders/services/report-rules";

const stamp = (iso: string | null) => (iso ? `${formatClinicDate(iso)} ${formatClinicTime(iso)}` : "—");

/** A test's rows: a heading and its parameters, or one line when it has a single parameter or a written result. */
function TestRows({ test }: { test: SnapshotTest }) {
  const hasText = test.parameters.length === 0;
  const single = test.parameters.length === 1 ? test.parameters[0] : null;
  const row = (parameter: SnapshotTest["parameters"][number], label: string, indent = false) => {
    const mark = flagMark(parameter.flag);
    const abnormal = parameter.flag !== null && parameter.flag !== "NORMAL";
    return (
      <tr key={label} className={abnormal ? "lab-report-abnormal" : undefined}>
        <td className={indent ? "lab-report-indent" : undefined}>{label}</td>
        <td className="lab-report-value">{parameter.value}</td>
        <td className="lab-report-flag">{mark}</td>
        <td>{parameter.unit ?? ""}</td>
        <td>{parameter.reference ?? ""}</td>
      </tr>
    );
  };
  return (
    <tbody className="lab-report-test">
      {single ? row(single, test.name) : (
        <>
          <tr className="lab-report-test-name"><th colSpan={5}>{test.name}{test.panel ? <small> · {test.panel}</small> : null}</th></tr>
          {hasText
            ? <tr><td colSpan={5} className="lab-report-text">{test.text}</td></tr>
            : test.parameters.map((parameter) => row(parameter, parameter.name, true))}
        </>
      )}
      {test.note && <tr><td colSpan={5} className="lab-report-note">Comment: {test.note}</td></tr>}
    </tbody>
  );
}

/**
 * The report as it is read and printed: letterhead, patient, results grouped by category, who approved
 * them, and a QR code that opens the "is this genuine?" page. Always black on white (paper), whatever
 * theme the screen uses. Every figure comes from the frozen snapshot, never from live records.
 */
export default function ReportDocument({ snapshot, reportCode, version, issuedAt, verifyCode, verifyUrl, preview = false }: {
  snapshot: ReportSnapshot;
  reportCode: string | null;
  version: number | null;
  issuedAt: string | null;
  verifyCode: string | null;
  verifyUrl: string | null;
  /** True before release: the page is a draft and says so across the middle. */
  preview?: boolean;
}) {
  const categories = [...new Set(snapshot.tests.map((test) => test.category))];
  const { lab, patient, order } = snapshot;
  const contact = [lab.address, lab.phone, lab.email].filter(Boolean);

  return (
    <article className="lab-report" lang="en">
      {preview && <div className="lab-report-watermark" aria-hidden>PREVIEW · NOT YET RELEASED</div>}

      <header className="lab-report-head">
        <div>
          <h1>{lab.name}</h1>
          <p>{lab.subtitle}</p>
          {contact.length > 0 && <p className="lab-report-contact">{contact.join(" · ")}</p>}
        </div>
        <div className="lab-report-title">
          <strong>LABORATORY REPORT</strong>
          {reportCode && <span>{reportCode}{version && version > 1 ? ` · version ${version}` : ""}</span>}
        </div>
      </header>

      <dl className="lab-report-facts">
        <div><dt>Patient</dt><dd>{patient.name}</dd></div>
        <div><dt>Order no.</dt><dd>{order.code}</dd></div>
        <div><dt>Patient ID</dt><dd>{patient.code}</dd></div>
        <div><dt>Ordered</dt><dd>{stamp(order.orderedAt)}</dd></div>
        <div><dt>Age / sex</dt><dd>{[patient.age, patient.sex ? SEX_LABEL[patient.sex] : ""].filter(Boolean).join(" / ") || "—"}</dd></div>
        <div><dt>Sample collected</dt><dd>{stamp(order.collectedAt)}</dd></div>
        <div><dt>Referred by</dt><dd>{order.referredBy ?? "—"}</dd></div>
        <div><dt>Reported</dt><dd>{stamp(issuedAt)}</dd></div>
      </dl>

      {categories.map((category) => (
        <section className="lab-report-category" key={category}>
          <h2>{category}</h2>
          <table className="lab-report-table">
            <thead><tr><th>Test</th><th>Result</th><th aria-label="Flag" /><th>Unit</th><th>Reference range</th></tr></thead>
            {snapshot.tests.filter((test) => test.category === category).map((test) => <TestRows key={test.code} test={test} />)}
          </table>
        </section>
      ))}

      <p className="lab-report-legend">H = above the normal range · L = below · HH / LL = critical · A = abnormal. Reference ranges are those used by this laboratory for this patient&apos;s age and sex.</p>

      <footer className="lab-report-foot">
        <div className="lab-report-signoff">
          <p>Approved by</p>
          <strong>{snapshot.verifiedBy.length ? snapshot.verifiedBy.join(", ") : "—"}</strong>
          <small>Results relate only to the sample received. Please interpret them together with the clinical findings.</small>
        </div>
        {verifyUrl && verifyCode && (
          <div className="lab-report-verify">
            <QrCode value={verifyUrl} size={84} label="QR code to verify this report" />
            <div>
              <strong>Verify this report</strong>
              <small>Scan the code, or open {verifyUrl.replace(/\/[^/]*$/, "")} and enter</small>
              <code>{formatVerifyCode(verifyCode)}</code>
            </div>
          </div>
        )}
      </footer>
    </article>
  );
}
