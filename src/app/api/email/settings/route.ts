import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { EmailSettingsError, getPublicSettings, saveSettings } from "@/modules/email/email-config-service";
import { emailSettingsSchema } from "@/modules/email/email-schema";
import { SecretBoxError, isEncryptionConfigured } from "@/modules/email/secret-box";

// These handlers use the default Node.js runtime (SMTP needs it). With Cache Components on, Next
// does not allow a `runtime` export, and Node.js is what runs.

export async function GET(request: Request) {
  const access = await authorize(request.headers, "email:manage");
  if (!access.session) return apiError(access.error, access.status);
  return NextResponse.json({ settings: await getPublicSettings(), encryptionConfigured: isEncryptionConfigured() });
}

export async function PUT(request: Request) {
  const access = await authorize(request.headers, "email:manage");
  if (!access.session) return apiError(access.error, access.status);
  if (!isEncryptionConfigured()) return apiError("EMAIL_ENCRYPTION_KEY is not set on the server, so SMTP passwords cannot be stored safely.", 503);
  const body = await parseBody(request, emailSettingsSchema, "Invalid e-mail settings.");
  if (!body.ok) return body.response;
  try {
    const settings = await saveSettings(body.data, access.session.user.id);
    await writeAuditEvent(request, access.session.user.id, "UPDATE", "EmailConfiguration", "primary", { enabled: settings.enabled });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof EmailSettingsError) return apiError(error.message, error.status);
    if (error instanceof SecretBoxError) return apiError("The encryption key on the server is not valid. See the server log.", 503);
    throw error;
  }
}
