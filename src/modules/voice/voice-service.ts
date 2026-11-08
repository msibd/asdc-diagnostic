import { randomUUID } from "node:crypto";
import { z } from "zod";
import { addClinicDays, getClinicDateKey } from "@/lib/clinic-date";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/modules/email/secret-box";
import { maskPhone, normalizeBdMobile, phoneHash } from "@/modules/sms/phone";
import { checkVoiceSetup, sendBroadcast, toLocalNumber, type VoiceCredentials } from "./awajdigital";

const ID = "primary";
// A patient gets at most one reminder call in this window, however often the button is pressed.
const REPEAT_WINDOW_MS = 20 * 60 * 60 * 1000;

export const voiceSettingsSchema = z.object({
  // Optional: leave out to keep the saved token. It is never sent back to the browser.
  token: z.string().trim().max(500).optional().transform((value) => value || undefined)
    .refine((value) => value === undefined || /^[\x21-\x7E]{16,500}$/.test(value), "The API token looks wrong. Copy it again from the AwajDigital panel."),
  // Passed to AwajDigital as typed: its docs show sender numbers both with and without 880.
  sender: z.string().trim().regex(/^\d{9,13}$/, "Enter the approved sender number in digits, for example 8809612000000."),
  reminderVoice: z.string().trim().min(1, "Enter the name of the approved reminder voice.").max(255),
  enabled: z.boolean(),
});
export const voiceReminderSchema = z.object({ days: z.number().int().min(1).max(14) });

export class VoiceSettingsError extends Error {
  constructor(message: string, readonly status: 400 | 409 = 409) {
    super(message);
    this.name = "VoiceSettingsError";
  }
}

async function writeLog(entry: { purpose: string; status: string; msisdn?: string; providerCode?: string | null; message?: string; appointmentId?: string; actorId?: string }) {
  try {
    await prisma.smsLog.create({
      data: {
        purpose: entry.purpose, status: entry.status,
        recipient: entry.msisdn ? maskPhone(entry.msisdn) : null, recipientHash: entry.msisdn ? phoneHash(entry.msisdn) : null,
        providerCode: entry.providerCode ?? null, message: entry.message?.slice(0, 300) ?? null,
        appointmentId: entry.appointmentId ?? null, actorId: entry.actorId ?? null,
      },
    });
  } catch (error) {
    logger.error("Could not write the voice log.", { error, purpose: entry.purpose });
  }
}

const readRow = () => prisma.voiceConfiguration.findUnique({ where: { id: ID } });

/** What the settings screen may see. The token is never part of this. */
export async function getPublicVoiceSettings() {
  const row = await readRow();
  return {
    sender: row?.sender ?? "", reminderVoice: row?.reminderVoice ?? "", tokenSet: Boolean(row?.encryptedToken), enabled: row?.enabled ?? false,
    lastTestAt: row?.lastTestAt?.toISOString() ?? null, lastTestStatus: row?.lastTestStatus ?? null, lastTestMessage: row?.lastTestMessage ?? null,
  };
}

async function loadCredentials(requireEnabled: boolean) {
  const row = await readRow();
  if (!row?.encryptedToken || !row.sender || !row.reminderVoice) return null;
  if (requireEnabled && !row.enabled) return null;
  const credentials: VoiceCredentials = { token: decryptSecret(row.encryptedToken), sender: row.sender };
  return { credentials, voice: row.reminderVoice };
}

export async function saveVoiceSettings(input: z.infer<typeof voiceSettingsSchema>, actorId: string) {
  const previous = await readRow();
  const { token, enabled, sender, reminderVoice } = input;
  if (!token && !previous?.encryptedToken) throw new VoiceSettingsError("Enter the API token.", 400);
  const changed = !previous || Boolean(token) || previous.sender !== sender || previous.reminderVoice !== reminderVoice;
  // Voice calls cost money, so they only switch on after the saved setup passed a connection test.
  if (enabled && (changed || previous?.lastTestStatus !== "SUCCESS")) throw new VoiceSettingsError("Test the connection successfully before turning voice calls on.");

  const data = {
    sender, reminderVoice, enabled, updatedById: actorId,
    encryptedToken: token ? encryptSecret(token) : previous?.encryptedToken ?? null,
    ...(changed ? { lastTestAt: null, lastTestStatus: null, lastTestMessage: null } : {}),
  };
  await prisma.voiceConfiguration.upsert({ where: { id: ID }, create: { id: ID, ...data }, update: data });
  await writeLog({ purpose: "VOICE_SETTINGS_UPDATED", status: "INFO", actorId, message: enabled ? "Voice settings saved (on)" : "Voice settings saved (off)" });
  return getPublicVoiceSettings();
}

/** Checks the token, sender and voice. Places no call. */
export async function testVoiceConnection(actorId: string) {
  const loaded = await loadCredentials(false);
  if (!loaded) throw new VoiceSettingsError("Save the API token, sender number and voice name first.", 400);
  const result = await checkVoiceSetup(loaded.credentials, loaded.voice);
  const message = result.ok ? result.detail : result.message;
  await prisma.voiceConfiguration.update({ where: { id: ID }, data: { lastTestAt: new Date(), lastTestStatus: result.ok ? "SUCCESS" : "FAILED", lastTestMessage: message.slice(0, 300) } });
  await writeLog({ purpose: "VOICE_CONNECTION_TEST", status: result.ok ? "SUCCESS" : "FAILED", providerCode: result.ok ? null : result.code, actorId, message });
  return { ok: result.ok, message };
}

export const isVoiceEnabled = async () => Boolean((await readRow())?.enabled);

/**
 * Calls every patient with a pending or confirmed booking from now until the end of the look-ahead
 * period and plays the approved reminder voice. Patients already called in the last 20 hours are
 * skipped, so pressing the button twice never pays twice.
 */
export async function sendVoiceReminders(days: number, actorId: string): Promise<{ ok: boolean; message: string; called: number; skipped: number }> {
  const loaded = await loadCredentials(true);
  if (!loaded) return { ok: false, message: "Voice calls are turned off. Turn them on in SMS & voice settings.", called: 0, skipped: 0 };

  const now = new Date();
  const end = new Date(`${addClinicDays(getClinicDateKey(now), days + 1)}T00:00:00+06:00`);
  const appointments = await prisma.appointment.findMany({
    where: { status: { in: ["PENDING", "CONFIRMED"] }, dateTime: { gte: now, lt: end } },
    select: { id: true, patientPhone: true }, orderBy: { dateTime: "asc" }, take: 999,
  });
  const alreadyCalled = new Set((await prisma.smsLog.findMany({
    where: { purpose: "VOICE_REMINDER", status: "SENT", createdAt: { gte: new Date(now.getTime() - REPEAT_WINDOW_MS) }, appointmentId: { in: appointments.map((row) => row.id) } },
    select: { appointmentId: true },
  })).map((row) => row.appointmentId));

  // One call per number, even when a patient has two bookings in the period.
  const targets = new Map<string, string[]>();
  let skipped = 0;
  for (const appointment of appointments) {
    const msisdn = normalizeBdMobile(appointment.patientPhone);
    if (!msisdn || alreadyCalled.has(appointment.id)) { skipped += 1; continue; }
    targets.set(msisdn, [...(targets.get(msisdn) ?? []), appointment.id]);
  }
  if (!targets.size) return { ok: true, message: skipped ? "Everyone in this period was already called or has no valid mobile number." : "No upcoming bookings in this period.", called: 0, skipped };

  const result = await sendBroadcast(loaded.credentials, loaded.voice, [...targets.keys()].map(toLocalNumber), randomUUID());
  const detail = result.ok ? `${result.detail}${result.broadcastId ? ` Broadcast ${result.broadcastId}.` : ""}` : result.message;
  for (const [msisdn, ids] of targets) {
    for (const appointmentId of ids) {
      await writeLog({ purpose: "VOICE_REMINDER", status: result.ok ? "SENT" : "FAILED", msisdn, appointmentId, actorId, providerCode: result.ok ? result.broadcastId ?? null : result.code, message: detail });
    }
  }
  return result.ok
    ? { ok: true, message: `Reminder calls sent to ${targets.size} patient${targets.size === 1 ? "" : "s"}.${skipped ? ` ${skipped} skipped (already called or no valid mobile).` : ""}`, called: targets.size, skipped }
    : { ok: false, message: result.message, called: 0, skipped };
}
