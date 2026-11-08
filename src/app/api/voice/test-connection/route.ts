import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError } from "@/lib/api";
import { hitRateLimit } from "@/lib/rate-limit";
import { SecretBoxError } from "@/modules/email/secret-box";
import { VoiceSettingsError, getPublicVoiceSettings, testVoiceConnection } from "@/modules/voice/voice-service";

// Checks the saved token, sender and voice at AwajDigital. Places no call.
export async function POST(request: Request) {
  const access = await authorize(request.headers, "sms:manage");
  if (!access.session) return apiError(access.error, access.status);
  const limit = await hitRateLimit(`voice:test:${access.session.user.id}`, 10, 10 * 60);
  if (limit.limited) return apiError("Too many tests. Wait a few minutes.", 429, { retryAfter: limit.retryAfter });
  try {
    const result = await testVoiceConnection(access.session.user.id);
    return NextResponse.json({ ...result, settings: await getPublicVoiceSettings() });
  } catch (error) {
    if (error instanceof VoiceSettingsError) return apiError(error.message, error.status);
    if (error instanceof SecretBoxError) return apiError("The saved API token cannot be read with the key on the server. Enter it again and save.", 503);
    throw error;
  }
}
