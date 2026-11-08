import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody } from "@/lib/api";
import { hitRateLimit } from "@/lib/rate-limit";
import { EmailSettingsError, getPublicSettings, sendTestEmail } from "@/modules/email/email-config-service";
import { testSendSchema } from "@/modules/email/email-schema";
import { SecretBoxError } from "@/modules/email/secret-box";

// Sends one test message. The result says whether the mail server ACCEPTED it; that is not proof
// it reached the inbox, and the screen words it that way.
export async function POST(request: Request) {
  const access = await authorize(request.headers, "email:manage");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, testSendSchema, "Enter a valid e-mail address.");
  if (!body.ok) return body.response;
  const limit = await hitRateLimit(`email:test:${access.session.user.id}`, 10, 10 * 60);
  if (limit.limited) return apiError("Too many tests. Wait a few minutes.", 429, { retryAfter: limit.retryAfter });
  try {
    const result = await sendTestEmail(body.data.to, access.session.user.id);
    return NextResponse.json({ ...result, settings: await getPublicSettings() });
  } catch (error) {
    if (error instanceof EmailSettingsError) return apiError(error.message, error.status);
    if (error instanceof SecretBoxError) return apiError("The saved password cannot be read with the key on the server. Enter the password again and save.", 503);
    throw error;
  }
}
