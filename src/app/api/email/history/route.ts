import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError } from "@/lib/api";
import { listEmailAudit } from "@/modules/email/email-config-service";

export async function GET(request: Request) {
  const access = await authorize(request.headers, "email:manage");
  if (!access.session) return apiError(access.error, access.status);
  return NextResponse.json({ history: await listEmailAudit(50) });
}
