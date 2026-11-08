import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/rate-limit";
import { RecoveryError, verifyPasswordResetOtp } from "@/modules/password-recovery/recovery-service";

const schema = z.object({
  email: z.string().trim().email().max(160),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export async function POST(request: Request) {
  const body = await parseBody(request, schema, "Enter the 6-digit code.");
  if (!body.ok) return body.response;
  try {
    const result = await verifyPasswordResetOtp(body.data.email, body.data.code, clientIp(request));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof RecoveryError) return apiError(error.message, error.status, { retryAfter: error.retryAfter });
    throw error;
  }
}
