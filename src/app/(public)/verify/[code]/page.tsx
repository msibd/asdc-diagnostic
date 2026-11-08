import type { Metadata } from "next";
import Link from "next/link";
import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { formatClinicDate } from "@/lib/clinic-date";
import { lookupVerification } from "@/modules/orders/services/report-service";

export const metadata: Metadata = { title: "Verify a report", robots: { index: false, follow: false }, referrer: "no-referrer" };
export const instant = false;

/**
 * The page a report's QR code opens. It says whether the report is genuine and still valid, and shows
 * only a masked name: no results. Anyone holding a printed report may check it; nobody learns anything
 * medical from it.
 */
export default async function VerifyReportPage(props: PageProps<"/verify/[code]">) {
  const { code } = await props.params;
  const found = await lookupVerification(decodeURIComponent(code));

  return (
    <main className="lab-report-page lab-report-gate">
      <section className="lab-report-pin lab-report-verdict" aria-live="polite">
        {!found && (
          <>
            <CircleX size={34} className="is-bad" aria-hidden />
            <h1>Report not found</h1>
            <p>No report matches this code. Check that it was typed correctly. If it was, this report may not be genuine: please contact the laboratory.</p>
          </>
        )}
        {found?.status === "ISSUED" && (
          <>
            <CircleCheck size={34} className="is-good" aria-hidden />
            <h1>Genuine report</h1>
            <p>This report was issued by <strong>{found.lab}</strong> on {formatClinicDate(found.issuedAt.toISOString())}.</p>
          </>
        )}
        {found?.status === "WITHDRAWN" && (
          <>
            <CircleAlert size={34} className="is-warn" aria-hidden />
            <h1>Report withdrawn</h1>
            <p>This report was issued by <strong>{found.lab}</strong> but has since been <strong>withdrawn</strong>{found.withdrawnAt ? ` (${formatClinicDate(found.withdrawnAt.toISOString())})` : ""}. Do not rely on it: ask the laboratory for the current report.</p>
          </>
        )}
        {found && (
          <dl className="lab-report-verdict-facts">
            <div><dt>Report</dt><dd>{found.reportCode}{found.version > 1 ? ` (version ${found.version})` : ""}</dd></div>
            <div><dt>Patient</dt><dd>{found.patient}</dd></div>
            <div><dt>Tests</dt><dd>{found.tests}</dd></div>
          </dl>
        )}
        <Link className="button-secondary" href="/verify">Check another report</Link>
      </section>
    </main>
  );
}
