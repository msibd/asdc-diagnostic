import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { loadResultSheet } from "@/modules/orders/services/result-service";

/** The result-entry sheet of an order: each test with its parameters, applicable ranges and saved values. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "orders:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const sheet = await loadResultSheet(id);
  if (!sheet) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  return NextResponse.json({ sheet });
}
