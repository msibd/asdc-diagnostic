import { NextResponse } from "next/server";
import { openReportSchema } from "@/modules/orders/schemas/order-schema";
import { openReport, siteOrigin } from "@/modules/orders/services/report-service";

// The patient's report: opened with the secret link and a PIN. Public, so it answers in a way that
// gives nothing away: a wrong PIN never says whether the link or the PIN was the problem, and the
// attempts are counted (see openReport).
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = openReportSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Enter your PIN." }, { status: 400 });
  const { token } = await params;

  let result;
  try {
    result = await openReport(token, parsed.data.pin, request);
  } catch {
    // The attempt counter or database was unreachable: refuse rather than allow unlimited guessing.
    return NextResponse.json({ error: "The report cannot be opened right now. Please try again in a few minutes." }, { status: 503 });
  }

  const headers = { "Cache-Control": "no-store" };
  switch (result.kind) {
    case "report":
      return NextResponse.json({ report: { reportCode: result.reportCode, version: result.version, issuedAt: result.issuedAt, verifyCode: result.verifyCode, verifyUrl: `${siteOrigin(request)}/verify/${result.verifyCode}`, snapshot: result.snapshot } }, { headers });
    case "withdrawn":
      return NextResponse.json({ withdrawn: true, reportCode: result.reportCode, error: "This report has been withdrawn by the laboratory. Please contact the laboratory." }, { status: 410, headers });
    case "limited":
      return NextResponse.json({ error: "Too many wrong attempts. Please wait a while and try again." }, { status: 429, headers: { ...headers, "Retry-After": String(result.retryAfter) } });
    case "wrong-pin":
    case "not-found":
      return NextResponse.json({ error: "The link or PIN is not correct." }, { status: 403, headers });
  }
}
