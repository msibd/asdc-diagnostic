import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/rate-limit";
import { RecoveryError, completePasswordReset } from "@/modules/password-recovery/recovery-service";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(10, "The password must be at least 10 characters.").max(128, "The password is too long."),
});

export async function POST(request: Request) {
  const body = await parseBody(request, schema, "Invalid request.");
  if (!body.ok) return body.response;
  try {
    await completePasswordReset(body.data.token, body.data.password, clientIp(request));
  } catch (error) {
    if (error instanceof RecoveryError) return apiError(error.message, error.status, { retryAfter: error.retryAfter });
    throw error;
  }
  return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
}
