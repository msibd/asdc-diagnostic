import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { reportActionSchema } from "@/modules/orders/schemas/order-schema";
import { auditFor, orderErrorResponse, readJson } from "@/modules/orders/services/order-http";
import { loadReportView, releaseReport, siteOrigin, withdrawReport } from "@/modules/orders/services/report-service";

/** The released report (or a preview of it) with its delivery status, for the staff screen. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "orders:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const view = await loadReportView(id, siteOrigin(request));
  if (!view) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json(view);
}

/** Release the report to the patient, or withdraw it (with a reason) so it can be corrected. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "results:release");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = await readJson(request);
  if (!body.ok) return body.response;
  const parsed = reportActionSchema.safeParse(body.body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { id } = await params;
  const record = auditFor(request, access.session.user.id);
  try {
    if (parsed.data.action === "release") await releaseReport(id, access.session.user.name, record);
    else await withdrawReport(id, parsed.data.reason, access.session.user.name, record);
    const view = await loadReportView(id, siteOrigin(request));
    return NextResponse.json(view);
  } catch (error) {
    return orderErrorResponse(error);
  }
}
