import { prisma } from "@/lib/prisma";
import { writeEmailAudit } from "./email-audit";
import type { EmailSettingsInput } from "./email-schema";
import { sendMail, verifyConnection, type MailConfig, type SendOutcome } from "./mailer";
import { decryptSecret, encryptSecret, needsReencryption } from "./secret-box";
import { emailTestEmail, type EmailContent } from "./templates";
import { BRAND_NAME } from "@/lib/brand";

const ID = "primary";

export class EmailSettingsError extends Error {
  constructor(message: string, readonly status: 400 | 409 | 503 = 409) {
    super(message);
    this.name = "EmailSettingsError";
  }
}

async function readRow() {
  return prisma.emailConfiguration.findUnique({ where: { id: ID } });
}

/** What the settings screen may see. The password and its ciphertext are never part of this. */
export async function getPublicSettings() {
  const row = await readRow();
  return {
    provider: row?.provider ?? "gmail",
    host: row?.host ?? "smtp.gmail.com",
    port: row?.port ?? 465,
    secure: row?.secure ?? true,
    authMethod: row?.authMethod ?? "APP_PASSWORD",
    username: row?.username ?? "",
    senderEmail: row?.senderEmail ?? "",
    senderName: row?.senderName ?? BRAND_NAME,
    passwordSet: Boolean(row?.encryptedPassword),
    enabled: row?.enabled ?? false,
    lastTestAt: row?.lastTestAt?.toISOString() ?? null,
    lastTestStatus: row?.lastTestStatus ?? null,
    lastTestMessage: row?.lastTestMessage ?? null,
    updatedAt: row?.updatedAt.toISOString() ?? null,
  };
}

/** The settings with the password decrypted, ready for the mailer. Server-side use only. */
async function loadMailConfig(requireEnabled: boolean): Promise<MailConfig | null> {
  const row = await readRow();
  if (!row?.encryptedPassword || !row.username || !row.senderEmail) return null;
  if (requireEnabled && !row.enabled) return null;
  return {
    host: row.host, port: row.port, secure: row.secure, authMethod: row.authMethod,
    username: row.username, password: decryptSecret(row.encryptedPassword),
    senderEmail: row.senderEmail, senderName: row.senderName,
  };
}

/** True when e-mail is switched on and complete (used to decide whether "Forgot password" is offered). */
export async function isEmailEnabled() {
  const row = await readRow();
  return Boolean(row?.enabled && row.encryptedPassword);
}

export async function saveSettings(input: EmailSettingsInput, actorId: string) {
  const previous = await readRow();
  const { password, enabled, ...rest } = input;
  if (!password && !previous?.encryptedPassword) throw new EmailSettingsError("Enter the SMTP password.", 400);

  const connectionChanged = !previous
    || previous.host !== rest.host || previous.port !== rest.port || previous.secure !== rest.secure
    || previous.authMethod !== rest.authMethod || previous.username !== rest.username
    || Boolean(password);

  // The stored password is re-encrypted with the current key when it is replaced, or when a key rotation left it on an old key.
  let encryptedPassword = previous?.encryptedPassword ?? null;
  if (password) encryptedPassword = encryptSecret(password);
  else if (encryptedPassword && needsReencryption(encryptedPassword)) encryptedPassword = encryptSecret(decryptSecret(encryptedPassword));

  // E-mail can only be switched on after the saved connection has passed a test.
  const testedOk = !connectionChanged && previous?.lastTestStatus === "SUCCESS";
  if (enabled && !testedOk) {
    throw new EmailSettingsError("Test the connection successfully before turning e-mail on.", 409);
  }

  const data = {
    ...rest, encryptedPassword, enabled, updatedById: actorId,
    ...(connectionChanged ? { lastTestAt: null, lastTestStatus: null, lastTestMessage: null } : {}),
  };
  await prisma.emailConfiguration.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });

  const changes = [
    previous?.provider !== rest.provider && "provider", previous?.host !== rest.host && "host", previous?.port !== rest.port && "port",
    previous?.secure !== rest.secure && "secure", previous?.authMethod !== rest.authMethod && "authMethod", previous?.username !== rest.username && "username",
    previous?.senderEmail !== rest.senderEmail && "senderEmail", previous?.senderName !== rest.senderName && "senderName",
    Boolean(password) && "password", (previous?.enabled ?? false) !== enabled && (enabled ? "enabled" : "disabled"),
  ].filter(Boolean).join(", ");
  // Names of what changed, never their values.
  await writeEmailAudit({ action: "SETTINGS_UPDATED", status: "SUCCESS", actorId, message: changes ? `Changed: ${changes}` : "Saved with no changes" });
  return getPublicSettings();
}

async function recordTest(status: "SUCCESS" | "FAILED", message: string) {
  await prisma.emailConfiguration.updateMany({ where: { id: ID }, data: { lastTestAt: new Date(), lastTestStatus: status, lastTestMessage: message.slice(0, 300) } });
}

export async function testConnection(actorId: string) {
  const config = await loadMailConfig(false);
  if (!config) throw new EmailSettingsError("Save the SMTP settings and password first.", 400);
  const result = await verifyConnection(config);
  const message = result.ok ? "Connected and signed in to the mail server." : result.message;
  await recordTest(result.ok ? "SUCCESS" : "FAILED", message);
  await writeEmailAudit({ action: "CONNECTION_TEST", status: result.ok ? "SUCCESS" : "FAILED", actorId, message, details: result.ok ? undefined : { code: result.code } });
  return { ok: result.ok, message };
}

export async function sendTestEmail(to: string, actorId: string) {
  const config = await loadMailConfig(false);
  if (!config) throw new EmailSettingsError("Save the SMTP settings and password first.", 400);
  const outcome = await sendMail(config, to, emailTestEmail({ senderName: config.senderName, host: config.host, port: config.port }));
  const message = outcome.ok ? "The mail server accepted the test e-mail for delivery." : outcome.message;
  await recordTest(outcome.ok ? "SUCCESS" : "FAILED", message);
  await writeEmailAudit({ action: "TEST_EMAIL", status: outcome.ok ? "SUCCESS" : "FAILED", actorId, recipient: to, message, details: outcome.ok ? undefined : { code: outcome.code } });
  return { ok: outcome.ok, message };
}

/**
 * Sends a system e-mail (e.g. a password reset code) with the saved settings. Returns the outcome
 * instead of throwing, so callers decide what to tell the user. Does nothing when e-mail is off.
 */
export async function sendSystemEmail(
  to: string,
  content: EmailContent,
  audit: { action: string; actorId?: string | null },
): Promise<SendOutcome | { ok: false; code: "DISABLED"; message: string }> {
  let config: MailConfig | null;
  try {
    config = await loadMailConfig(true);
  } catch {
    await writeEmailAudit({ action: audit.action, status: "FAILED", recipient: to, message: "The saved SMTP password could not be read (check EMAIL_ENCRYPTION_KEY)." });
    return { ok: false, code: "DISABLED", message: "E-mail is not available." };
  }
  if (!config) return { ok: false, code: "DISABLED", message: "E-mail is turned off." };
  const outcome = await sendMail(config, to, content);
  await writeEmailAudit({
    action: audit.action, status: outcome.ok ? "SUCCESS" : "FAILED", actorId: audit.actorId, recipient: to,
    message: outcome.ok ? "Accepted by the mail server." : outcome.message, details: outcome.ok ? undefined : { code: outcome.code },
  });
  return outcome;
}

export async function listEmailAudit(limit = 50) {
  const rows = await prisma.emailAuditLog.findMany({
    orderBy: { createdAt: "desc" }, take: limit,
    select: { id: true, action: true, status: true, recipient: true, message: true, createdAt: true, actor: { select: { name: true } } },
  });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), actor: row.actor?.name ?? null }));
}
