import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError } from "@/lib/api";
import { listSmsLog } from "@/modules/sms/sms-service";

export async function GET(request: Request) {
  const access = await authorize(request.headers, "sms:manage");
  if (!access.session) return apiError(access.error, access.status);
  return NextResponse.json({ history: await listSmsLog(50) });
}
