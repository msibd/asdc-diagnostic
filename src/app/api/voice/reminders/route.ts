import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody } from "@/lib/api";
import { hitRateLimit } from "@/lib/rate-limit";
import { SecretBoxError } from "@/modules/email/secret-box";
import { sendVoiceReminders, voiceReminderSchema } from "@/modules/voice/voice-service";

// Plays the approved reminder voice to every upcoming patient in the look-ahead period. Costs money.
export async function POST(request: Request) {
  const access = await authorize(request.headers, "appointments:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, voiceReminderSchema, "Invalid reminder request.");
  if (!body.ok) return body.response;
  const limit = await hitRateLimit(`voice:reminders:${access.session.user.id}`, 5, 60 * 60);
  if (limit.limited) return apiError("Reminder calls were sent several times this hour. Wait a while.", 429, { retryAfter: limit.retryAfter });
  try {
    const result = await sendVoiceReminders(body.data.days, access.session.user.id);
    return result.ok ? NextResponse.json(result) : apiError(result.message, 409);
  } catch (error) {
    if (error instanceof SecretBoxError) return apiError("The saved voice API token cannot be read. An admin must enter it again.", 503);
    throw error;
  }
}
