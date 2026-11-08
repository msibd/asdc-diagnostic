import { NextResponse } from "next/server";
import { writeAuditEvent } from "@/lib/audit";
import { OrderError, type AuditRecorder } from "@/modules/orders/services/order-service";

/** Binds the audit log to the request and the signed-in user, for use inside a transaction. */
export const auditFor = (request: Request, userId: string): AuditRecorder =>
  (db, action, entity, entityId, details) => writeAuditEvent(request, userId, action, entity, entityId, details, db);

/** Problems the person can fix become a normal error response; anything else is a real bug and rethrown. */
export function orderErrorResponse(error: unknown) {
  if (error instanceof OrderError) return NextResponse.json({ error: error.message }, { status: error.status });
  throw error;
}

export async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 }) };
  }
}
