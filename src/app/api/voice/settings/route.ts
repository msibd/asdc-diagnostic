import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { SecretBoxError, isEncryptionConfigured } from "@/modules/email/secret-box";
import { VoiceSettingsError, getPublicVoiceSettings, saveVoiceSettings, voiceSettingsSchema } from "@/modules/voice/voice-service";

export async function GET(request: Request) {
  const access = await authorize(request.headers, "sms:manage");
  if (!access.session) return apiError(access.error, access.status);
  return NextResponse.json({ settings: await getPublicVoiceSettings(), encryptionConfigured: isEncryptionConfigured() });
}

export async function PUT(request: Request) {
  const access = await authorize(request.headers, "sms:manage");
  if (!access.session) return apiError(access.error, access.status);
  if (!isEncryptionConfigured()) return apiError("EMAIL_ENCRYPTION_KEY is not set on the server, so the API token cannot be stored safely.", 503);
  const body = await parseBody(request, voiceSettingsSchema, "Invalid voice settings.");
  if (!body.ok) return body.response;
  try {
    const settings = await saveVoiceSettings(body.data, access.session.user.id);
    await writeAuditEvent(request, access.session.user.id, "UPDATE", "VoiceConfiguration", "primary", { enabled: settings.enabled });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof VoiceSettingsError) return apiError(error.message, error.status);
    if (error instanceof SecretBoxError) return apiError("The encryption key on the server is not valid. See the server log.", 503);
    throw error;
  }
}
