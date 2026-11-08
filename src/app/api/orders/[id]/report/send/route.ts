import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { sendReportSchema } from "@/modules/orders/schemas/order-schema";
import { auditFor, readJson } from "@/modules/orders/services/order-http";
import { loadReportView, sendReportLink, siteOrigin } from "@/modules/orders/services/report-service";

/** Sends the patient the link to their released report by SMS or e-mail. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "reports:send");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = sendReportSchema.safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { id } = await params;
  const origin = siteOrigin(request);
  const outcome = await sendReportLink(id, parsed.data.channel, { id: access.session.user.id, name: access.session.user.name }, origin, auditFor(request, access.session.user.id));
  // A failed send is a normal answer the screen shows to the person, not a server error.
  const view = await loadReportView(id, origin);
  return NextResponse.json({ ...outcome, view }, { status: outcome.ok ? 200 : 422 });
}
