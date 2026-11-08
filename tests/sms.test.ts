import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as staffBooking } from "@/app/api/appointments/route";
import { GET as smsHistory } from "@/app/api/sms/history/route";
import { GET as getSmsSettings, PUT as putSmsSettings } from "@/app/api/sms/settings/route";
import { POST as smsTestConnection } from "@/app/api/sms/test-connection/route";
import { POST as smsTestSend } from "@/app/api/sms/test-send/route";
import { POST as publicBooking } from "@/app/public_website/api/appointments/route";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/modules/email/secret-box";
import { checkBalance, describeGatewayCode, sendSms } from "@/modules/sms/bulksmsbd";
import { maskPhone, normalizeBdMobile, phoneHash } from "@/modules/sms/phone";
import { DEFAULT_APPOINTMENT_TEMPLATE } from "@/modules/sms/sms-schema";
import { renderAppointmentSms, sendReportReadySms } from "@/modules/sms/sms-service";
import { call, clinicTime, createSession, ensureDoctorSchedule, type TestUser } from "./helpers";

// A fake BulkSMSBD: no request ever leaves the machine. Records every call for inspection.
type Sent = { url: string; method: string; body: URLSearchParams | null };
let sent: Sent[] = [];
let smsCode = 202;
const gateway = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  const href = String(url);
  sent.push({ url: href, method: init?.method ?? "GET", body: init?.body instanceof URLSearchParams ? init.body : null });
  if (href.includes("getBalanceApi")) return Response.json({ response_code: 202, balance: 150.5 });
  return Response.json(smsCode === 202 ? { response_code: 202, message_id: 1, success_message: "SMS Submitted Successfully" } : { response_code: smsCode, error_message: "x" });
});
const smsSends = () => sent.filter((entry) => entry.url.includes("/smsapi"));

const API_KEY = "TestKey1234567890abcd";
let admin: TestUser;
let receptionist: TestUser;
let ipCounter = 0;

const settingsBody = (overrides: Record<string, unknown> = {}) => ({
  apiKey: API_KEY, senderId: "8809600000000", appointmentTemplate: DEFAULT_APPOINTMENT_TEMPLATE,
  perNumberDailyLimit: 3, dailyLimit: 200, enabled: false, ...overrides,
});
const save = (body: Record<string, unknown>, cookie = admin.cookie) => call(putSmsSettings, "/api/sms/settings", { method: "PUT", cookie, body });

/** Switches SMS on directly (the screen's own rules are tested separately below). */
async function enableSms(overrides: Record<string, unknown> = {}) {
  await prisma.smsConfiguration.create({
    data: { id: "primary", encryptedApiKey: encryptSecret(API_KEY), senderId: "8809600000000", enabled: true, lastTestStatus: "SUCCESS", ...overrides },
  });
}

async function book(phone: string, name = "Rahim Uddin", days = 70 + ipCounter) {
  ipCounter += 1;
  return publicBooking(new Request("http://localhost:3000/public_website/api/appointments", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `192.0.2.${ipCounter}` },
    body: JSON.stringify({ patientName: name, patientPhone: phone, service: "SMS Check", dateTime: clinicTime(days, "10:00") }),
  }));
}

/** The SMS goes out after the response; wait for its log line. */
async function waitForLog(appointmentId: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const row = await prisma.smsLog.findFirst({ where: { appointmentId } });
    if (row) return row;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  return null;
}

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  await ensureDoctorSchedule();
  await prisma.clinicService.upsert({ where: { code: "SMSCHK" }, create: { code: "SMSCHK", name: "SMS Check", standardPrice: 100, durationMinutes: 15 }, update: {} });
});

beforeEach(async () => {
  sent = [];
  smsCode = 202;
  gateway.mockClear();
  vi.stubGlobal("fetch", gateway);
  await prisma.smsConfiguration.deleteMany();
  await prisma.smsLog.deleteMany();
  await prisma.$executeRaw`DELETE FROM "rateLimit" WHERE key LIKE 'sms:%'`;
});

afterEach(() => vi.unstubAllGlobals());

describe("phone numbers", () => {
  it("accepts the usual ways of writing a Bangladeshi mobile number", () => {
    for (const input of ["01712345678", "01712-345678", "+8801712345678", "8801712345678", " 0171 234 5678 "]) {
      expect(normalizeBdMobile(input), input).toBe("8801712345678");
    }
    for (const input of ["01212345678", "0171234567", "+441234567890", "", null]) expect(normalizeBdMobile(input)).toBeNull();
  });

  it("masks and hashes numbers so the log never holds them", () => {
    expect(maskPhone("8801712345678")).toBe("88017*****678");
    expect(phoneHash("8801712345678")).toMatch(/^[0-9a-f]{64}$/);
    expect(phoneHash("8801712345678")).not.toBe(phoneHash("8801712345679"));
  });
});

describe("BulkSMSBD gateway", () => {
  it("posts over HTTPS with the key in the body, never in the address", async () => {
    const result = await sendSms({ apiKey: API_KEY, senderId: "8809600000000" }, "8801712345678", "Hi & welcome @ 5$");
    expect(result.ok).toBe(true);
    const [request] = smsSends();
    expect(request.url).toBe("https://bulksmsbd.net/api/smsapi");
    expect(request.method).toBe("POST");
    expect(request.url).not.toContain(API_KEY);
    expect(request.body?.get("api_key")).toBe(API_KEY);
    expect(request.body?.get("number")).toBe("8801712345678");
    expect(request.body?.get("message")).toBe("Hi & welcome @ 5$"); // encoded by URLSearchParams
  });

  it("explains provider error codes and network failures", async () => {
    smsCode = 1007;
    expect(await sendSms({ apiKey: API_KEY, senderId: "x" }, "8801712345678", "t")).toEqual({ ok: false, code: "1007", message: describeGatewayCode(1007) });
    expect(describeGatewayCode(1032)).toMatch(/whitelisted/);
    expect(describeGatewayCode(4242)).toMatch(/code 4242/);
    const offline = vi.fn(async () => { throw new TypeError("fetch failed"); });
    expect(await sendSms({ apiKey: API_KEY, senderId: "x" }, "8801712345678", "t", offline as unknown as typeof fetch)).toMatchObject({ ok: false, code: "NETWORK" });
    const garbage = vi.fn(async () => new Response("<html>oops</html>", { status: 500 }));
    const unreadable = await sendSms({ apiKey: API_KEY, senderId: "x" }, "8801712345678", "t", garbage as unknown as typeof fetch);
    expect(unreadable.ok).toBe(false);
    expect(JSON.stringify(unreadable)).not.toContain("oops");
  });

  it("checks the key by reading the balance", async () => {
    expect(await checkBalance(API_KEY)).toMatchObject({ ok: true, detail: "Connected. Balance: 150.50 BDT." });
    expect(sent[0].url.startsWith("https://bulksmsbd.net/api/getBalanceApi?api_key=")).toBe(true);
  });
});

describe("message text", () => {
  it("fills the placeholders in clinic time and cleans the name", () => {
    const text = renderAppointmentSms("{clinic}: {name}, {date} {time}", {
      name: "  Rahim\n\u0007 Uddin  ", dateTime: new Date("2026-11-07T11:30:00Z"), clinic: "Dr Ovi",
    });
    expect(text).toBe("Dr Ovi: Rahim Uddin, 7 Nov 2026 5:30 PM");
    expect(renderAppointmentSms("", { name: "A", dateTime: new Date(), clinic: "C" })).toContain("C:");
  });
});

describe("SMS settings screen", () => {
  it("is for administrators only", async () => {
    expect((await call(getSmsSettings, "/api/sms/settings")).status).toBe(401);
    expect((await call(getSmsSettings, "/api/sms/settings", { cookie: receptionist.cookie })).status).toBe(403);
    expect((await save(settingsBody(), receptionist.cookie)).status).toBe(403);
    expect((await call(smsTestConnection, "/api/sms/test-connection", { method: "POST", cookie: receptionist.cookie })).status).toBe(403);
    expect((await call(smsTestSend, "/api/sms/test-send", { method: "POST", cookie: receptionist.cookie, body: { to: "01712345678" } })).status).toBe(403);
    expect((await call(smsHistory, "/api/sms/history", { cookie: receptionist.cookie })).status).toBe(403);
    expect(gateway).not.toHaveBeenCalled();
  });

  it("stores the API key encrypted and never returns it", async () => {
    const response = await save(settingsBody());
    expect(response.status).toBe(200);
    expect(response.json.settings.apiKeySet).toBe(true);
    expect(JSON.stringify(response.json)).not.toContain(API_KEY);
    const row = await prisma.smsConfiguration.findUniqueOrThrow({ where: { id: "primary" } });
    expect(row.encryptedApiKey).not.toContain(API_KEY);
    expect(decryptSecret(row.encryptedApiKey!)).toBe(API_KEY);
    const history = await call(smsHistory, "/api/sms/history", { cookie: admin.cookie });
    expect(JSON.stringify(history.json)).not.toContain(API_KEY);
  });

  it("validates input", async () => {
    expect((await save(settingsBody({ apiKey: undefined }))).status).toBe(400); // first save needs the key
    expect((await save(settingsBody({ apiKey: "bad key!" }))).status).toBe(400);
    expect((await save(settingsBody({ senderId: "<script>" }))).status).toBe(400);
    expect((await save(settingsBody({ appointmentTemplate: "Hello {patientPhone}" }))).status).toBe(400);
    expect((await save(settingsBody({ perNumberDailyLimit: 0 }))).status).toBe(400);
    expect((await save(settingsBody({ dailyLimit: 100000 }))).status).toBe(400);
  });

  it("turns SMS on only after a successful connection test, and re-locks after a key change", async () => {
    await save(settingsBody());
    expect((await save(settingsBody({ apiKey: undefined, enabled: true }))).status).toBe(409);
    const tested = await call(smsTestConnection, "/api/sms/test-connection", { method: "POST", cookie: admin.cookie });
    expect(tested.json).toMatchObject({ ok: true, message: "Connected. Balance: 150.50 BDT." });
    expect((await save(settingsBody({ apiKey: undefined, enabled: true }))).json.settings.enabled).toBe(true);
    // A new key must be tested again.
    expect((await save(settingsBody({ apiKey: "AnotherKey1234567890", enabled: true }))).status).toBe(409);
  });

  it("sends a test SMS and logs it with a masked number", async () => {
    await save(settingsBody());
    expect((await call(smsTestSend, "/api/sms/test-send", { method: "POST", cookie: admin.cookie, body: { to: "12345" } })).status).toBe(400);
    const response = await call(smsTestSend, "/api/sms/test-send", { method: "POST", cookie: admin.cookie, body: { to: "01712345678" } });
    expect(response.json.ok).toBe(true);
    expect(smsSends()).toHaveLength(1);
    const log = await prisma.smsLog.findFirstOrThrow({ where: { purpose: "TEST_SMS" } });
    expect(log.recipient).toBe("88017*****678");
    expect(JSON.stringify(log)).not.toContain("8801712345678");
  });
});

describe("appointment SMS", () => {
  it("texts the booked number after a website booking", async () => {
    await enableSms();
    const response = await book("01811-223344", "Karim");
    expect(response.status).toBe(201);
    const { appointment } = await response.json() as { appointment: { id: string } };
    const log = await waitForLog(appointment.id);
    expect(log).toMatchObject({ status: "SENT", recipient: "88018*****344", purpose: "APPOINTMENT_BOOKED" });
    const [request] = smsSends();
    expect(request.body?.get("number")).toBe("8801811223344");
    expect(request.body?.get("message")).toContain("Karim");
    expect(request.body?.get("message")).not.toContain("SMS Check"); // the treatment is not put in an SMS
  });

  it("uses the patient's registered number when staff book for a linked patient", async () => {
    await enableSms();
    const patient = await prisma.patient.create({ data: { patientCode: "PID-SMS-1", name: "Registered Person", phone: "01999887766" } });
    const response = await call(staffBooking, "/api/appointments", {
      method: "POST", cookie: admin.cookie,
      body: { patientId: patient.id, patientName: "", patientPhone: "", service: "SMS Check", dateTime: clinicTime(80, "11:00") },
    });
    expect(response.status).toBe(201);
    expect((await waitForLog(response.json.appointment.id))?.status).toBe("SENT");
    expect(smsSends()[0].body?.get("number")).toBe("8801999887766");
  });

  it("sends nothing when SMS is off, and texts a walk-in once it is on", async () => {
    const response = await book("01711000111");
    expect(response.status).toBe(201);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(smsSends()).toHaveLength(0);

    await enableSms();
    await prisma.doctorSchedule.updateMany({ where: { doctorId: "primary" }, data: { startTime: "00:00", endTime: "23:59" } });
    try {
      const walkIn = await call(staffBooking, "/api/appointments", {
        method: "POST", cookie: admin.cookie, body: { patientName: "Walk In", patientPhone: "01711000222", service: "SMS Check", walkIn: true },
      });
      expect(walkIn.status).toBe(201);
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(smsSends()).toHaveLength(1);
    } finally {
      await ensureDoctorSchedule();
    }
  });

  it("skips numbers it cannot text, and limits SMS per number per day", async () => {
    await enableSms({ perNumberDailyLimit: 2 });
    const foreign = await book("+441234567890");
    const foreignId = (await foreign.json() as { appointment: { id: string } }).appointment.id;
    expect((await waitForLog(foreignId))?.status).toBe("SKIPPED");

    const statuses: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      const response = await book("01755000555", `Flood ${index}`);
      const id = (await response.json() as { appointment: { id: string } }).appointment.id;
      statuses.push((await waitForLog(id))?.status ?? "none");
    }
    expect(statuses).toEqual(["SENT", "SENT", "SKIPPED"]);
    expect(smsSends()).toHaveLength(2);
  });

  it("never fails the booking when the provider fails", async () => {
    await enableSms();
    smsCode = 1007;
    const response = await book("01766000777");
    expect(response.status).toBe(201);
    const id = (await response.json() as { appointment: { id: string } }).appointment.id;
    const log = await waitForLog(id);
    expect(log).toMatchObject({ status: "FAILED", providerCode: "1007" });
    expect(log?.message).toMatch(/balance/i);
  });
});

describe("report-ready SMS", () => {
  const LINK_TEXT = "ASDC: Dear Rahim, your report ORD-000042 is ready. View it here: https://lab.example/r/SECRET-TOKEN-123 (PIN: last 4 digits of your mobile number)";
  const send = (to = "01712345678") => sendReportReadySms({ to, text: LINK_TEXT, actorId: admin.id });

  it("says so, and sends nothing, when SMS is turned off", async () => {
    const result = await send();
    expect(result).toEqual({ ok: false, message: expect.stringMatching(/turned off/i) });
    expect(smsSends()).toHaveLength(0);
  });

  it("sends the text to the normalised number and logs it WITHOUT the link", async () => {
    await enableSms();
    expect(await send("01712-345678")).toEqual({ ok: true, message: "SMS sent." });
    const [request] = smsSends();
    expect(request.body?.get("number")).toBe("8801712345678");
    expect(request.body?.get("message")).toBe(LINK_TEXT);
    const log = await prisma.smsLog.findFirstOrThrow({ where: { purpose: "REPORT_READY" } });
    expect(log).toMatchObject({ status: "SENT", recipient: maskPhone("8801712345678"), actorId: admin.id });
    expect(JSON.stringify(log)).not.toMatch(/SECRET-TOKEN|lab\.example|8801712345678/);
  });

  it("refuses a number that is not a Bangladeshi mobile and logs the skip", async () => {
    await enableSms();
    const result = await send("12345");
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not a Bangladeshi mobile/i);
    expect(smsSends()).toHaveLength(0);
    expect(await prisma.smsLog.findFirstOrThrow({ where: { purpose: "REPORT_READY" } })).toMatchObject({ status: "SKIPPED" });
  });

  it("allows five report texts to one number in a day, then stops", async () => {
    await enableSms({ perNumberDailyLimit: 1 }); // the booking limit does not apply to reports
    for (let i = 0; i < 5; i += 1) expect((await send()).ok, `send ${i + 1}`).toBe(true);
    const sixth = await send();
    expect(sixth).toEqual({ ok: false, message: expect.stringMatching(/too many/i) });
    expect(smsSends()).toHaveLength(5);
    expect((await send("01811223344")).ok).toBe(true); // another number is unaffected
  });

  it("honours the daily total", async () => {
    await enableSms({ dailyLimit: 1 });
    expect((await send("01712345678")).ok).toBe(true);
    expect(await send("01811223344")).toEqual({ ok: false, message: expect.stringMatching(/daily SMS limit/i) });
  });

  it("turns a provider refusal into a plain message and a FAILED log line", async () => {
    await enableSms();
    smsCode = 1007;
    const result = await send();
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/balance/i);
    expect(await prisma.smsLog.findFirstOrThrow({ where: { purpose: "REPORT_READY" } })).toMatchObject({ status: "FAILED", providerCode: "1007" });
  });
});
