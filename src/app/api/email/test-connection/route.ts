import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError } from "@/lib/api";
import { hitRateLimit } from "@/lib/rate-limit";
import { EmailSettingsError, getPublicSettings, testConnection } from "@/modules/email/email-config-service";
import { SecretBoxError } from "@/modules/email/secret-box";

// Opens a connection to the saved mail server and signs in. Sends nothing.
export async function POST(request: Request) {
  const access = await authorize(request.headers, "email:manage");
  if (!access.session) return apiError(access.error, access.status);
  const limit = await hitRateLimit(`email:test:${access.session.user.id}`, 10, 10 * 60);
  if (limit.limited) return apiError("Too many tests. Wait a few minutes.", 429, { retryAfter: limit.retryAfter });
  try {
    const result = await testConnection(access.session.user.id);
    return NextResponse.json({ ...result, settings: await getPublicSettings() });
  } catch (error) {
    if (error instanceof EmailSettingsError) return apiError(error.message, error.status);
    if (error instanceof SecretBoxError) return apiError("The saved password cannot be read with the key on the server. Enter the password again and save.", 503);
    throw error;
  }
}
