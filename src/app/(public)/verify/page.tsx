import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { normaliseVerifyCode } from "@/modules/orders/services/report-rules";

export const metadata: Metadata = { title: "Verify a report", robots: { index: false, follow: false } };
export const instant = false;

/** Someone without a QR scanner types the code printed on the report. */
export default async function VerifyLandingPage(props: PageProps<"/verify">) {
  const { code } = await props.searchParams;
  const typed = Array.isArray(code) ? code[0] : code;
  const normalised = normaliseVerifyCode(typed);
  if (normalised) redirect(`/verify/${normalised}`);

  return (
    <main className="lab-report-page lab-report-gate">
      <form className="lab-report-pin" action="/verify" method="get">
        <h1>Verify a report</h1>
        <p>Enter the verification code printed at the bottom of the report to check that it is genuine.</p>
        <label className="form-field">Verification code
          <input name="code" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={20} placeholder="XXXX-XXXX-XXXX" defaultValue={typed ?? ""} aria-invalid={typed ? true : undefined} />
        </label>
        {typed && <div className="form-error" role="alert">That is not a valid verification code. Check it and try again.</div>}
        <button className="button-primary" type="submit">Verify</button>
      </form>
    </main>
  );
}
