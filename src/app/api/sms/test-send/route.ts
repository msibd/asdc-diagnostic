import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody } from "@/lib/api";
import { hitRateLimit } from "@/lib/rate-limit";
import { SecretBoxError } from "@/modules/email/secret-box";
import { smsTestSendSchema } from "@/modules/sms/sms-schema";
import { SmsSettingsError, getPublicSmsSettings, sendTestSms } from "@/modules/sms/sms-service";

// Sends one test SMS (it costs one message). "ok" means the provider accepted it.
export async function POST(request: Request) {
  const access = await authorize(request.headers, "sms:manage");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, smsTestSendSchema, "Enter a mobile number.");
  if (!body.ok) return body.response;
  const limit = await hitRateLimit(`sms:test:${access.session.user.id}`, 10, 10 * 60);
  if (limit.limited) return apiError("Too many tests. Wait a few minutes.", 429, { retryAfter: limit.retryAfter });
  try {
    const result = await sendTestSms(body.data.to, access.session.user.id);
    return NextResponse.json({ ...result, settings: await getPublicSmsSettings() });
  } catch (error) {
    if (error instanceof SmsSettingsError) return apiError(error.message, error.status);
    if (error instanceof SecretBoxError) return apiError("The saved API key cannot be read with the key on the server. Enter it again and save.", 503);
    throw error;
  }
}
