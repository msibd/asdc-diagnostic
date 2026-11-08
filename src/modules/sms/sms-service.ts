import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { hitRateLimit } from "@/lib/rate-limit";
import { decryptSecret, encryptSecret, needsReencryption } from "@/modules/email/secret-box";
import { checkBalance, sendSms, type SmsCredentials } from "./bulksmsbd";
import { maskPhone, normalizeBdMobile, phoneHash } from "./phone";
import { DEFAULT_APPOINTMENT_TEMPLATE, type SmsSettingsInput } from "./sms-schema";
import { BRAND_NAME } from "@/lib/brand";

const ID = "primary";
const DAY_SECONDS = 24 * 60 * 60;
const CLINIC_FALLBACK = BRAND_NAME;

export class SmsSettingsError extends Error {
  constructor(message: string, readonly status: 400 | 409 = 409) {
    super(message);
    this.name = "SmsSettingsError";
  }
}

type LogEntry = {
  purpose: "APPOINTMENT_BOOKED" | "REPORT_READY" | "TEST_SMS" | "CONNECTION_TEST" | "SETTINGS_UPDATED";
  status: "SENT" | "FAILED" | "SKIPPED" | "SUCCESS" | "INFO";
  msisdn?: string | null;
  providerCode?: string | null;
  message?: string | null;
  appointmentId?: string | null;
  actorId?: string | null;
};

/** One line in the SMS history: masked number only, never the message text or the key. */
async function writeLog(entry: LogEntry) {
  try {
    await prisma.smsLog.create({
      data: {
        purpose: entry.purpose,
        status: entry.status,
        recipient: entry.msisdn ? maskPhone(entry.msisdn) : null,
        recipientHash: entry.msisdn ? phoneHash(entry.msisdn) : null,
        providerCode: entry.providerCode ?? null,
        message: entry.message?.slice(0, 300) ?? null,
        appointmentId: entry.appointmentId ?? null,
        actorId: entry.actorId ?? null,
      },
    });
  } catch (error) {
    logger.error("Could not write the SMS log.", { error, purpose: entry.purpose });
  }
}

const readRow = () => prisma.smsConfiguration.findUnique({ where: { id: ID } });

/** What the settings screen may see. The API key and its ciphertext are never part of this. */
export async function getPublicSmsSettings() {
  const row = await readRow();
  return {
    provider: row?.provider ?? "bulksmsbd",
    senderId: row?.senderId ?? "",
    apiKeySet: Boolean(row?.encryptedApiKey),
    enabled: row?.enabled ?? false,
    appointmentTemplate: row?.appointmentTemplate || DEFAULT_APPOINTMENT_TEMPLATE,
    perNumberDailyLimit: row?.perNumberDailyLimit ?? 3,
    dailyLimit: row?.dailyLimit ?? 200,
    lastTestAt: row?.lastTestAt?.toISOString() ?? null,
    lastTestStatus: row?.lastTestStatus ?? null,
    lastTestMessage: row?.lastTestMessage ?? null,
  };
}

async function loadCredentials(requireEnabled: boolean): Promise<(SmsCredentials & { row: NonNullable<Awaited<ReturnType<typeof readRow>>> }) | null> {
  const row = await readRow();
  if (!row?.encryptedApiKey || !row.senderId) return null;
  if (requireEnabled && !row.enabled) return null;
  return { apiKey: decryptSecret(row.encryptedApiKey), senderId: row.senderId, row };
}

export async function saveSmsSettings(input: SmsSettingsInput, actorId: string) {
  const previous = await readRow();
  const { apiKey, enabled, ...rest } = input;
  if (!apiKey && !previous?.encryptedApiKey) throw new SmsSettingsError("Enter the API key.", 400);

  const credentialsChanged = !previous || Boolean(apiKey) || previous.senderId !== rest.senderId;
  let encryptedApiKey = previous?.encryptedApiKey ?? null;
  if (apiKey) encryptedApiKey = encryptSecret(apiKey);
  else if (encryptedApiKey && needsReencryption(encryptedApiKey)) encryptedApiKey = encryptSecret(decryptSecret(encryptedApiKey));

  // SMS can only be switched on after the saved key has passed a connection test.
  if (enabled && (credentialsChanged || previous?.lastTestStatus !== "SUCCESS")) {
    throw new SmsSettingsError("Test the connection successfully before turning SMS on.");
  }

  const data = {
    ...rest,
    appointmentTemplate: rest.appointmentTemplate === DEFAULT_APPOINTMENT_TEMPLATE ? "" : rest.appointmentTemplate,
    encryptedApiKey, enabled, updatedById: actorId,
    ...(credentialsChanged ? { lastTestAt: null, lastTestStatus: null, lastTestMessage: null } : {}),
  };
  await prisma.smsConfiguration.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
  const changed = [
    Boolean(apiKey) && "API key", previous?.senderId !== rest.senderId && "sender ID",
    (previous?.appointmentTemplate || DEFAULT_APPOINTMENT_TEMPLATE) !== rest.appointmentTemplate && "message",
    previous?.perNumberDailyLimit !== rest.perNumberDailyLimit && "per-number limit", previous?.dailyLimit !== rest.dailyLimit && "daily limit",
    (previous?.enabled ?? false) !== enabled && (enabled ? "turned on" : "turned off"),
  ].filter(Boolean).join(", ");
  await writeLog({ purpose: "SETTINGS_UPDATED", status: "INFO", actorId, message: changed ? `Changed: ${changed}` : "Saved with no changes" });
  return getPublicSmsSettings();
}

async function recordTest(status: "SUCCESS" | "FAILED", message: string) {
  await prisma.smsConfiguration.updateMany({ where: { id: ID }, data: { lastTestAt: new Date(), lastTestStatus: status, lastTestMessage: message.slice(0, 300) } });
}

/** Checks the saved key by reading the balance. Sends no SMS. */
export async function testSmsConnection(actorId: string) {
  const credentials = await loadCredentials(false);
  if (!credentials) throw new SmsSettingsError("Save the API key and sender ID first.", 400);
  const result = await checkBalance(credentials.apiKey);
  const message = result.ok ? result.detail : result.message;
  await recordTest(result.ok ? "SUCCESS" : "FAILED", message);
  await writeLog({ purpose: "CONNECTION_TEST", status: result.ok ? "SUCCESS" : "FAILED", providerCode: result.code, actorId, message });
  return { ok: result.ok, message };
}

export async function sendTestSms(to: string, actorId: string) {
  const credentials = await loadCredentials(false);
  if (!credentials) throw new SmsSettingsError("Save the API key and sender ID first.", 400);
  const msisdn = normalizeBdMobile(to);
  if (!msisdn) throw new SmsSettingsError("Enter a Bangladeshi mobile number, for example 01712345678.", 400);
  const result = await sendSms(credentials, msisdn, `${await clinicName()}: test SMS. Your SMS settings work.`);
  const message = result.ok ? "The SMS provider accepted the test message." : result.message;
  await recordTest(result.ok ? "SUCCESS" : "FAILED", message);
  await writeLog({ purpose: "TEST_SMS", status: result.ok ? "SENT" : "FAILED", msisdn, providerCode: result.code, actorId, message });
  return { ok: result.ok, message };
}

async function clinicName() {
  const content = await prisma.clinicContent.findUnique({ where: { id: "primary" }, select: { clinicName: true } });
  return content?.clinicName?.trim() || CLINIC_FALLBACK;
}

/** Fills the message. Names are cleaned (no control characters, at most 40 characters). */
export function renderAppointmentSms(template: string, values: { name: string; dateTime: Date; clinic: string; doctor?: string | null }) {
  const name = values.name.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 40) || "Patient";
  const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }).format(values.dateTime);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(values.dateTime);
  const doctor = (values.doctor ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  const base = template || DEFAULT_APPOINTMENT_TEMPLATE;
  // A saved message written before {doctor} existed still names the doctor: the name is added at the end.
  const text = doctor && !base.includes("{doctor}") ? `${base} ডাক্তার: {doctor}।` : base;
  return text
    .replaceAll("{name}", name).replaceAll("{date}", date).replaceAll("{time}", time).replaceAll("{clinic}", values.clinic).replaceAll("{doctor}", doctor);
}

/**
 * Texts the patient that their appointment was booked. Never throws and never blocks the booking:
 * every outcome (sent, failed, skipped) is written to the SMS log instead.
 */
export async function notifyAppointmentBooked(appointment: { id: string; patientName: string; patientPhone: string; dateTime: Date }) {
  try {
    const credentials = await loadCredentials(true);
    if (!credentials) return; // SMS is off: nothing to do, nothing to log.
    const msisdn = normalizeBdMobile(appointment.patientPhone);
    if (!msisdn) {
      await writeLog({ purpose: "APPOINTMENT_BOOKED", status: "SKIPPED", appointmentId: appointment.id, message: "Not a Bangladeshi mobile number." });
      return;
    }
    // Guards against SMS flooding through the public booking form (and against runaway cost).
    const perNumber = await hitRateLimit(`sms:number:${phoneHash(msisdn)}`, credentials.row.perNumberDailyLimit, DAY_SECONDS);
    if (perNumber.limited) {
      await writeLog({ purpose: "APPOINTMENT_BOOKED", status: "SKIPPED", msisdn, appointmentId: appointment.id, message: "Daily limit for this number reached." });
      return;
    }
    const total = await hitRateLimit("sms:daily-total", credentials.row.dailyLimit, DAY_SECONDS);
    if (total.limited) {
      await writeLog({ purpose: "APPOINTMENT_BOOKED", status: "SKIPPED", msisdn, appointmentId: appointment.id, message: "Daily SMS limit reached." });
      logger.warn("Daily SMS limit reached; appointment SMS skipped.", { appointmentId: appointment.id });
      return;
    }
    const booked = await prisma.appointment.findUnique({ where: { id: appointment.id }, select: { doctor: { select: { name: true } } } });
    const text = renderAppointmentSms(credentials.row.appointmentTemplate, { name: appointment.patientName, dateTime: appointment.dateTime, clinic: await clinicName(), doctor: booked?.doctor?.name });
    const result = await sendSms(credentials, msisdn, text);
    await writeLog({
      purpose: "APPOINTMENT_BOOKED", status: result.ok ? "SENT" : "FAILED", msisdn, providerCode: result.code,
      appointmentId: appointment.id, message: result.ok ? result.detail : result.message,
    });
  } catch (error) {
    logger.error("Appointment SMS could not be sent.", { error, appointmentId: appointment.id });
  }
}

/**
 * Texts a patient the link to their report. Unlike the booking SMS this returns what happened, so the
 * screen can tell the person who pressed "Send" (turned off, bad number, limit reached, provider
 * error). The link is a secret, so it is never written to the log: only the provider's answer is.
 */
export async function sendReportReadySms({ to, text, actorId }: { to: string; text: string; actorId: string }): Promise<{ ok: boolean; message: string }> {
  const credentials = await loadCredentials(true);
  if (!credentials) return { ok: false, message: "SMS is turned off. Turn it on in SMS settings." };
  const msisdn = normalizeBdMobile(to);
  if (!msisdn) {
    await writeLog({ purpose: "REPORT_READY", status: "SKIPPED", actorId, message: "Not a Bangladeshi mobile number." });
    return { ok: false, message: "This is not a Bangladeshi mobile number, so no SMS was sent." };
  }
  const perNumber = await hitRateLimit(`sms:report:${phoneHash(msisdn)}`, 5, DAY_SECONDS);
  if (perNumber.limited) {
    await writeLog({ purpose: "REPORT_READY", status: "SKIPPED", msisdn, actorId, message: "Daily report-SMS limit for this number reached." });
    return { ok: false, message: "Too many report messages were sent to this number today. Try again tomorrow." };
  }
  const total = await hitRateLimit("sms:daily-total", credentials.row.dailyLimit, DAY_SECONDS);
  if (total.limited) {
    await writeLog({ purpose: "REPORT_READY", status: "SKIPPED", msisdn, actorId, message: "Daily SMS limit reached." });
    return { ok: false, message: "The daily SMS limit has been reached." };
  }
  const result = await sendSms(credentials, msisdn, text);
  await writeLog({ purpose: "REPORT_READY", status: result.ok ? "SENT" : "FAILED", msisdn, providerCode: result.code, actorId, message: result.ok ? result.detail : result.message });
  return result.ok ? { ok: true, message: "SMS sent." } : { ok: false, message: result.message };
}

export async function listSmsLog(limit = 50) {
  const rows = await prisma.smsLog.findMany({
    orderBy: { createdAt: "desc" }, take: limit,
    select: { id: true, purpose: true, status: true, recipient: true, providerCode: true, message: true, createdAt: true, actor: { select: { name: true } } },
  });
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), actor: row.actor?.name ?? null }));
}
