import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, parseBody } from "@/lib/api";
import { clientIp } from "@/lib/rate-limit";
import { OTP_RESEND_COOLDOWN_SECONDS } from "@/modules/password-recovery/otp";
import { RecoveryError, requestPasswordReset } from "@/modules/password-recovery/recovery-service";

const schema = z.object({ email: z.string().trim().email("Enter a valid e-mail address.").max(160) });

// An address that is not a registered, active staff account is told so and gets no code.
export async function POST(request: Request) {
  const body = await parseBody(request, schema, "Enter a valid e-mail address.");
  if (!body.ok) return body.response;
  try {
    const registered = await requestPasswordReset(body.data.email, clientIp(request));
    if (!registered) return apiError("No active staff account uses this e-mail address. Check the spelling, or ask an administrator.", 404);
  } catch (error) {
    if (error instanceof RecoveryError) {
      return apiError(error.message, error.status, { retryAfter: error.retryAfter });
    }
    throw error;
  }
  return NextResponse.json(
    { message: "A 6-digit code has been sent to your e-mail. It is valid for 5 minutes.", resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS },
    { headers: { "Cache-Control": "no-store" } },
  );
}
