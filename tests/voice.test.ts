import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as sendReminders } from "@/app/api/voice/reminders/route";
import { PUT as putVoiceSettings } from "@/app/api/voice/settings/route";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/modules/email/secret-box";
import { checkVoiceSetup, sendBroadcast } from "@/modules/voice/awajdigital";
import { call, clinicTime, createSession, type TestUser } from "./helpers";

// A fake AwajDigital: no request ever leaves the machine. Records every call for inspection.
type Sent = { url: string; method: string; auth: string | null; body: Record<string, unknown> | null };
let sent: Sent[] = [];
let broadcastStatus = 200;
let voiceStatus = "approved";
const gateway = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  const href = String(url);
  sent.push({ url: href, method: init?.method ?? "GET", auth: new Headers(init?.headers).get("authorization"), body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
  if (href.endsWith("/balance")) return Response.json({ success: true, balance: 1250.75 });
  if (href.endsWith("/senders")) return Response.json({ success: true, senders: [{ id: 1, callingNumber: "09612000000", status: "active" }] });
  if (href.endsWith("/voices")) return Response.json({ success: true, voices: [{ id: 7, name: "Appointment-Reminder", status: voiceStatus }] });
  if (broadcastStatus !== 200) return Response.json({ success: false, message: "x" }, { status: broadcastStatus });
  return Response.json({ success: true, broadcast: { id: 42, name: "b", status: "pending", createdAt: "2026-11-08T00:00:00Z" } });
});
const broadcasts = () => sent.filter((entry) => entry.url.endsWith("/broadcasts"));

const TOKEN = "awaj_test_token_1234567890";
const CREDS = { token: TOKEN, sender: "8809612000000" };
let admin: TestUser;
let receptionist: TestUser;

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
});

beforeEach(async () => {
  sent = [];
  broadcastStatus = 200;
  voiceStatus = "approved";
  vi.stubGlobal("fetch", gateway);
  await prisma.voiceConfiguration.deleteMany();
  await prisma.smsLog.deleteMany();
  await prisma.$executeRaw`DELETE FROM "rateLimit" WHERE key LIKE 'voice:%'`;
});

afterEach(() => vi.unstubAllGlobals());

describe("AwajDigital gateway", () => {
  it("posts the broadcast over HTTPS with the token in the header, never in the address", async () => {
    const result = await sendBroadcast(CREDS, "Appointment-Reminder", ["01712345678"], "req-0123456789abcdef");
    expect(result).toMatchObject({ ok: true, broadcastId: "42" });
    const [request] = broadcasts();
    expect(request.url).toBe("https://api.awajdigital.com/api/broadcasts");
    expect(request.url).not.toContain(TOKEN);
    expect(request.auth).toBe(`Bearer ${TOKEN}`);
    expect(request.body).toEqual({ request_id: "req-0123456789abcdef", voice: "Appointment-Reminder", sender: "8809612000000", phone_numbers: ["01712345678"] });
  });

  it("explains a low balance in plain words", async () => {
    broadcastStatus = 402;
    expect(await sendBroadcast(CREDS, "v", ["01712345678"], "req-0123456789abcdef")).toMatchObject({ ok: false, code: "402", message: expect.stringContaining("balance") });
  });

  it("checks sender and voice without placing a call", async () => {
    expect(await checkVoiceSetup(CREDS, "appointment-reminder")).toMatchObject({ ok: true });
    voiceStatus = "pending";
    expect(await checkVoiceSetup(CREDS, "appointment-reminder")).toMatchObject({ ok: false, code: "VOICE" });
    expect(await checkVoiceSetup({ ...CREDS, sender: "8809699999999" }, "appointment-reminder")).toMatchObject({ ok: false, code: "SENDER" });
    expect(broadcasts()).toHaveLength(0);
  });
});

describe("voice settings", () => {
  const body = { token: TOKEN, sender: "8809612000000", reminderVoice: "Appointment-Reminder", enabled: false };

  it("refuses to turn voice on before a successful test, and is admin-only", async () => {
    expect((await call(putVoiceSettings, "/api/voice/settings", { method: "PUT", cookie: admin.cookie, body: { ...body, enabled: true } })).status).toBe(409);
    expect((await call(putVoiceSettings, "/api/voice/settings", { method: "PUT", cookie: receptionist.cookie, body })).status).toBe(403);
    const saved = await call(putVoiceSettings, "/api/voice/settings", { method: "PUT", cookie: admin.cookie, body });
    expect(saved.status).toBe(200);
    expect(saved.json.settings).toMatchObject({ tokenSet: true, enabled: false });
    expect(JSON.stringify(saved.json)).not.toContain(TOKEN);
  });
});

describe("voice reminders", () => {
  it("calls each upcoming patient once and never twice in a day", async () => {
    await prisma.voiceConfiguration.create({ data: { id: "primary", encryptedToken: encryptSecret(TOKEN), sender: "8809612000000", reminderVoice: "Appointment-Reminder", enabled: true, lastTestStatus: "SUCCESS" } });
    const when = new Date(clinicTime(1, "11:00"));
    const base = { service: "Voice Check", dateTime: when, status: "CONFIRMED" as const };
    await prisma.appointment.createMany({ data: [
      { ...base, patientName: "Voice A", patientPhone: "01755501001" },
      { ...base, patientName: "Voice A again", patientPhone: "+8801755501001" },
      { ...base, patientName: "Voice B", patientPhone: "12345" },
    ] });

    const first = await call(sendReminders, "/api/voice/reminders", { method: "POST", cookie: receptionist.cookie, body: { days: 1 } });
    expect(first.status).toBe(200);
    const numbers = broadcasts()[0].body?.phone_numbers as string[];
    expect(numbers.filter((number) => number === "01755501001")).toHaveLength(1); // two bookings, one call
    expect(numbers).not.toContain("12345");

    sent = [];
    const second = await call(sendReminders, "/api/voice/reminders", { method: "POST", cookie: receptionist.cookie, body: { days: 1 } });
    expect(second.status).toBe(200);
    expect((broadcasts()[0]?.body?.phone_numbers as string[] | undefined) ?? []).not.toContain("01755501001");
  });

  it("says so when voice calls are off", async () => {
    const response = await call(sendReminders, "/api/voice/reminders", { method: "POST", cookie: receptionist.cookie, body: { days: 1 } });
    expect(response.status).toBe(409);
    expect(broadcasts()).toHaveLength(0);
  });
});
