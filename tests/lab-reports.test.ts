import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createOrder } from "@/app/api/orders/route";
import { POST as reviewOrder } from "@/app/api/orders/[id]/review/route";
import { GET as getReport, POST as reportAction } from "@/app/api/orders/[id]/report/route";
import { POST as sendReport } from "@/app/api/orders/[id]/report/send/route";
import { PATCH as changeSample } from "@/app/api/samples/[id]/route";
import { PUT as putResults } from "@/app/api/results/[itemId]/route";
import { POST as openPublic } from "@/app/public_website/api/reports/[token]/route";
import { prisma } from "@/lib/prisma";
import { reportReadyEmail } from "@/modules/email/templates";
import {
  VERIFY_ALPHABET, flagMark, formatVerifyCode, maskName, normaliseVerifyCode, pinFromPhone, pinMatches, renderReportSms,
} from "@/modules/orders/services/report-rules";
import { lookupVerification, newAccessToken, newVerifyCode } from "@/modules/orders/services/report-service";
import { call, createSession, patientInput, type TestUser } from "./helpers";

// Sending crosses into the SMS provider and the mail server. Those two doors are replaced here (their
// own behaviour is tested in sms.test.ts and email.test.ts), so this file can check what we hand them.
const sendSms = vi.fn<(input: { to: string; text: string; actorId: string }) => Promise<{ ok: boolean; message: string }>>();
const sendEmail = vi.fn<(...args: unknown[]) => Promise<{ ok: boolean; code?: string; message?: string }>>();
vi.mock("@/modules/sms/sms-service", async (original) => ({ ...(await original<typeof import("@/modules/sms/sms-service")>()), sendReportReadySms: (input: { to: string; text: string; actorId: string }) => sendSms(input) }));
vi.mock("@/modules/email/email-config-service", async (original) => ({ ...(await original<typeof import("@/modules/email/email-config-service")>()), sendSystemEmail: (...args: unknown[]) => sendEmail(...args) }));
vi.mock("@/lib/public-cache", () => ({
  publicCacheTags: { clinic: "public-clinic", gallery: "public-gallery", reviews: "public-reviews" },
  invalidatePublicCache: () => undefined,
}));

// ---------------------------------------------------------------- pure rules

describe("the patient's PIN (pure)", () => {
  it.each([["01712345678", "5678"], ["01712-345678", "5678"], ["+880 1712 345678", "5678"], ["8801712345678", "5678"], ["1234567", "4567"]])("%s -> %s", (phone, pin) => expect(pinFromPhone(phone)).toBe(pin));
  it.each([[""], [null], [undefined], ["123456"], ["abc"]])("gives no PIN for %j", (phone) => expect(pinFromPhone(phone as string | null)).toBeNull());

  it("accepts the right PIN with spaces or a dash, and nothing else", () => {
    const phone = "01712345678";
    for (const typed of ["5678", " 5678 ", "56-78", "56 78"]) expect(pinMatches(phone, typed), typed).toBe(true);
    for (const typed of ["5679", "567", "56789", "abcd", "", null, undefined, "5678a", "0001"]) expect(pinMatches(phone, typed as string), String(typed)).toBe(false);
  });
  it("never matches when the phone cannot give a PIN", () => {
    expect(pinMatches("12345", "2345")).toBe(false);
    expect(pinMatches(null, "")).toBe(false);
  });
});

describe("verification codes and names (pure)", () => {
  it("formats and reads a code back whatever way it is typed", () => {
    expect(formatVerifyCode("7K2M9QXP4DFA")).toBe("7K2M-9QXP-4DFA");
    for (const typed of ["7K2M9QXP4DFA", "7k2m-9qxp-4dfa", " 7K2M 9QXP 4DFA "]) expect(normaliseVerifyCode(typed)).toBe("7K2M9QXP4DFA");
  });
  it.each([[""], [null], ["SHORT"], ["7K2M9QXP4DFAA"], ["0O1I0O1I0O1I"], ["7K2M9QXP4DF!"]])("refuses %j", (typed) => expect(normaliseVerifyCode(typed as string | null)).toBeNull());

  it("makes unguessable, unambiguous codes", () => {
    const codes = new Set(Array.from({ length: 200 }, newVerifyCode));
    expect(codes.size).toBe(200);
    for (const code of codes) {
      expect(code).toHaveLength(12);
      expect([...code].every((char) => VERIFY_ALPHABET.includes(char))).toBe(true);
      expect(normaliseVerifyCode(code)).toBe(code);
    }
    expect(VERIFY_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("makes long URL-safe link tokens that never repeat", () => {
    const tokens = new Set(Array.from({ length: 200 }, newAccessToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/);
  });

  it("masks a name down to initials", () => {
    expect(maskName("Rahim Uddin")).toBe("R**** U****");
    expect(maskName("  Ma  ")).toBe("M*");
    expect(maskName("A")).toBe("A*");
    expect(maskName("")).toBe("");
    expect(maskName("Abdullah-Al-Mamun Chowdhury")).not.toContain("bdullah");
  });

  it("prints flags in a way that survives a black-and-white printer", () => {
    expect([flagMark("NORMAL"), flagMark("LOW"), flagMark("HIGH"), flagMark("CRITICAL_LOW"), flagMark("CRITICAL_HIGH"), flagMark("ABNORMAL"), flagMark(null)]).toEqual(["", "L", "H", "LL", "HH", "A", ""]);
  });
});

describe("messages to the patient (pure)", () => {
  const link = "https://lab.example/r/abc123";
  it("the SMS has the link and the PIN hint, and only the first name", () => {
    const text = renderReportSms({ lab: "ASDC Diagnostic", name: "Rahim Uddin", orderCode: "ORD-000042", link });
    expect(text).toContain(link);
    expect(text).toContain("ORD-000042");
    expect(text).toMatch(/last 4 digits/);
    expect(text).toContain("Dear Rahim,");
    expect(text).not.toContain("Uddin");
  });
  it("cleans a strange name instead of breaking the message", () => {
    expect(renderReportSms({ lab: "L", name: "\n\t  ", orderCode: "O", link })).toContain("Dear Patient,");
    expect(renderReportSms({ lab: "L", name: "A".repeat(100), orderCode: "O", link })).toContain(`Dear ${"A".repeat(20)},`);
  });
  it("the e-mail has the link, the PIN hint and no results, and escapes the name", () => {
    const mail = reportReadyEmail({ name: "<b>Rahim</b>", orderCode: "ORD-000042", link, lab: "ASDC Diagnostic" });
    expect(mail.html).toContain(link);
    expect(mail.html).not.toContain("<b>Rahim</b>");
    expect(mail.html).toContain("&lt;b&gt;Rahim");
    expect(mail.text).toContain(link);
    expect(`${mail.html}${mail.text}`).toMatch(/last 4 digits/);
    expect(mail.subject).toContain("ORD-000042");
  });
});

// ---------------------------------------------------------------- the whole flow

let admin: TestUser;
let receptionist: TestUser;
let lab: TestUser;
let pathologist: TestUser;
const run = Date.now().toString(36).toUpperCase();
let counter = 0;
let ipCounter = 0;
const code = (prefix: string) => `${prefix}${run}${counter++}`;
const ids: Record<string, string> = {};
/** A mobile number ending in the PIN the test will type. The rest is random so it never matches another test file's patients. */
const ph = (pin: string) => `0158${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}${pin}`;
const nextIp = () => `198.51.100.${(ipCounter += 1)}`;

const makePatient = async (over: Record<string, unknown> = {}) =>
  prisma.patient.create({ data: { ...patientInput(), patientCode: code("PID-L"), sex: "MALE", dateOfBirth: new Date(Date.now() - 40 * 365.25 * 86_400_000), ...over } });

async function makeTest(key: string, name: string, parameters: [string, string | null, { sex?: "ANY" | "MALE" | "FEMALE"; low?: number; high?: number; note?: string }[]][], category = "Biochemistry") {
  const row = await prisma.clinicService.create({
    data: {
      code: code("LR"), name: `${name} ${run}`, category, kind: "TEST", sampleType: "Blood", standardPrice: 300, durationMinutes: 15,
      parameters: { create: parameters.map(([parameter, unit, ranges], index) => ({ name: parameter, unit, sortOrder: index, ranges: { create: ranges.map((range) => ({ sex: range.sex ?? "ANY", low: range.low ?? null, high: range.high ?? null, note: range.note ?? null })) } })) },
    },
  });
  ids[key] = row.id;
}

const sample = (id: string, action: string) => call(changeSample, `/api/samples/${id}`, { method: "PATCH", body: { action }, cookie: lab.cookie, params: { id } });
const enter = (itemId: string, body: Record<string, unknown>, cookie = lab.cookie) => call(putResults, `/api/results/${itemId}`, { method: "PUT", body, cookie, params: { itemId } });
const review = (orderId: string, body: Record<string, unknown>, cookie = pathologist.cookie) => call(reviewOrder, `/api/orders/${orderId}/review`, { method: "POST", body, cookie, params: { id: orderId } });
const action = (orderId: string, body: Record<string, unknown>, cookie = pathologist.cookie) => call(reportAction, `/api/orders/${orderId}/report`, { method: "POST", body, cookie, params: { id: orderId } });
const view = (orderId: string, cookie = admin.cookie) => call(getReport, `/api/orders/${orderId}/report`, { cookie, params: { id: orderId } });
const send = (orderId: string, channel: string, cookie = receptionist.cookie) => call(sendReport, `/api/orders/${orderId}/report/send`, { method: "POST", body: { channel }, cookie, params: { id: orderId } });
const open = (token: string, pin: string, ip = nextIp()) => call(openPublic, `/public_website/api/reports/${token}`, { method: "POST", body: { pin }, headers: { "x-forwarded-for": ip }, params: { token } });
const tokenOf = (link: string) => link.split("/r/")[1];

type ReadyOrder = { id: string; items: { id: string; testId: string }[] };
/** An order whose every test has results that the pathologist has approved: ready to release. */
async function verifiedOrder(patientId: string, serviceKeys: string[] = ["glucose"], values: Record<string, string> = {}): Promise<ReadyOrder> {
  const placed = await call(createOrder, "/api/orders", { method: "POST", body: { patientId, serviceIds: serviceKeys.map((key) => ids[key]) }, cookie: receptionist.cookie });
  expect(placed.status).toBe(201);
  let order = placed.json.order;
  for (const entry of order.samples) {
    await sample(entry.id, "collect");
    order = (await sample(entry.id, "receive")).json.order;
  }
  for (const item of order.items as { id: string; testId: string }[]) {
    const key = Object.keys(ids).find((candidate) => ids[candidate] === item.testId)!;
    const typed = key === "glucose" ? { Glucose: values.Glucose ?? "105" } : key === "hb" ? { Haemoglobin: values.Haemoglobin ?? "12.4" } : {};
    expect((await enter(item.id, { values: Object.entries(typed).map(([name, value]) => ({ name, value })) })).status).toBe(200);
  }
  expect((await review(order.id, { action: "verify" })).status).toBe(200);
  return order;
}
const itemOf = (order: ReadyOrder, key: string) => order.items.find((item) => item.testId === ids[key])!.id;

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  lab = await createSession("lab_staff");
  pathologist = await createSession("pathologist");
  await makeTest("glucose", "Glucose test", [["Glucose", "mg/dL", [{ low: 70, high: 100 }]]]);
  await makeTest("hb", "Haemoglobin test", [["Haemoglobin", "g/dL", [{ sex: "MALE", low: 13, high: 17 }, { sex: "FEMALE", low: 12, high: 15 }]]], "Haematology");
});

beforeEach(() => {
  sendSms.mockClear();
  sendEmail.mockClear();
  sendSms.mockImplementation(async () => ({ ok: true, message: "SMS sent." }));
  sendEmail.mockImplementation(async () => ({ ok: true }));
});

describe("releasing a report", () => {
  it("is refused until every test is approved, and only the pathologist may release", async () => {
    const patient = await makePatient();
    const placed = (await call(createOrder, "/api/orders", { method: "POST", body: { patientId: patient.id, serviceIds: [ids.glucose] }, cookie: receptionist.cookie })).json.order;
    const early = await action(placed.id, { action: "release" });
    expect(early.status).toBe(409);
    expect(early.json.error).toMatch(/approved|after/i);

    const ready = await verifiedOrder(patient.id);
    expect((await action(ready.id, { action: "release" }, receptionist.cookie)).status).toBe(403);
    expect((await action(ready.id, { action: "release" }, lab.cookie)).status).toBe(403);
    expect((await action("missing", { action: "release" })).status).toBe(404);
  });

  it("freezes the report, marks the order released, and gives it a code, a link and a verification code", async () => {
    const patient = await makePatient({ name: "Rahim Uddin", phone: ph("3344") });
    const order = await verifiedOrder(patient.id, ["glucose", "hb"]);
    const done = await action(order.id, { action: "release" });
    expect(done.status).toBe(200);
    const { report } = done.json;
    expect(report).toMatchObject({ version: 1, issuedBy: expect.any(String) });
    expect(report.reportCode).toMatch(/^RPT-\d{6}$/);
    expect(report.link).toMatch(/\/r\/[A-Za-z0-9_-]{24}$/);
    expect(report.verifyCode).toHaveLength(12);
    expect(done.json.status).toBe("DELIVERED");

    const snapshot = report.snapshot;
    expect(snapshot.patient).toMatchObject({ name: "Rahim Uddin", sex: "MALE", age: "40 y" });
    expect(snapshot.lab.name).toBeTruthy();
    expect(snapshot.order.code).toMatch(/^ORD-/);
    expect(snapshot.tests.map((test: { category: string }) => test.category)).toEqual(["Biochemistry", "Haematology"]); // grouped by category
    const glucose = snapshot.tests.find((test: { parameters: { name: string }[] }) => test.parameters[0]?.name === "Glucose");
    expect(glucose.parameters[0]).toMatchObject({ value: "105", unit: "mg/dL", flag: "HIGH", reference: "70 – 100" });
    expect(glucose.verifiedBy).toEqual(expect.any(String));
    expect(snapshot.verifiedBy).toHaveLength(1);
    expect(snapshot.hasCritical).toBe(false);

    expect((await action(order.id, { action: "release" })).status).toBe(409); // not twice
    expect((await prisma.auditEvent.count({ where: { action: "RELEASE", entity: "LabReport", entityId: report.id } }))).toBe(1);
  });

  it("flags a report that holds a critical value", async () => {
    const patient = await makePatient();
    await prisma.testReferenceRange.updateMany({ where: { parameter: { testId: ids.glucose } }, data: { criticalHigh: 400 } });
    const order = await verifiedOrder(patient.id, ["glucose"], { Glucose: "450" });
    expect((await action(order.id, { action: "release" })).json.report.snapshot.hasCritical).toBe(true);
    await prisma.testReferenceRange.updateMany({ where: { parameter: { testId: ids.glucose } }, data: { criticalHigh: null } });
  });

  it("previews before release and reports what is still owed", async () => {
    const patient = await makePatient();
    const order = await verifiedOrder(patient.id);
    const before = await view(order.id);
    expect(before.status).toBe(200);
    expect(before.json).toMatchObject({ status: "VERIFIED", report: null, pinHint: true, due: "300.00" });
    expect(before.json.preview.tests).toHaveLength(1);
    const after = await view(order.id, receptionist.cookie);
    expect(after.status).toBe(200);
    await action(order.id, { action: "release" });
    const released = await view(order.id);
    expect(released.json.preview).toBeNull();
    expect(released.json.report.reportCode).toMatch(/^RPT-/);
    expect((await view("missing")).status).toBe(404);
    expect((await call(getReport, `/api/orders/${order.id}/report`, { params: { id: order.id } })).status).toBeGreaterThanOrEqual(401);
  });

  it("an issued report never changes when the patient, the catalog or the results change later", async () => {
    const patient = await makePatient({ name: "Karim Hossain", phone: ph("7788") });
    const order = await verifiedOrder(patient.id);
    const { report } = (await action(order.id, { action: "release" })).json;
    const token = tokenOf(report.link);

    await prisma.patient.update({ where: { id: patient.id }, data: { name: "Someone Else", phone: patient.phone } });
    await prisma.clinicService.update({ where: { id: ids.glucose }, data: { name: `Renamed ${run}` } });
    await prisma.doctorProfile.upsert({ where: { id: "primary" }, create: { id: "primary", slug: "dr-x", name: "Dr X", address: "New address" }, update: { address: "New address" } });

    const shown = await open(token, "7788");
    expect(shown.status).toBe(200);
    expect(shown.json.report.snapshot.patient.name).toBe("Karim Hossain");
    expect(shown.json.report.snapshot.tests[0].name).not.toContain("Renamed");
    expect(shown.json.report.snapshot.lab.address).not.toBe("New address");
  });

  it("locks the results while a report is out", async () => {
    const order = await verifiedOrder((await makePatient()).id);
    await action(order.id, { action: "release" });
    const edit = await enter(itemOf(order, "glucose"), { values: [{ name: "Glucose", value: "90" }] }, admin.cookie);
    expect(edit.status).toBe(409);
    expect(edit.json.error).toMatch(/released|Withdraw/i);
    const back = await review(order.id, { action: "return", itemId: itemOf(order, "glucose"), reason: "Mix-up suspected" });
    expect(back.status).toBe(409);
    expect(back.json.error).toMatch(/Withdraw/i);
  });
});

describe("the patient opening a report", () => {
  it("needs the right PIN, and says nothing about which part was wrong", async () => {
    const order = await verifiedOrder((await makePatient({ phone: ph("0011") })).id);
    const token = tokenOf((await action(order.id, { action: "release" })).json.report.link);

    const wrong = await open(token, "1111");
    expect(wrong.status).toBe(403);
    const unknown = await open("A".repeat(24), "0011");
    expect(unknown.status).toBe(403);
    expect(unknown.json.error).toBe(wrong.json.error);
    expect((await open("../../etc/passwd", "0011")).status).toBe(403);
    expect((await open(token, "")).status).toBe(400);
    expect((await open(token, "x".repeat(40))).status).toBe(400);

    const right = await open(token, "0011");
    expect(right.status).toBe(200);
    expect(right.json.report).toMatchObject({ version: 1, reportCode: expect.stringMatching(/^RPT-/) });
    expect((await open(token, "00-11")).status).toBe(200);
  });

  it("counts views, and the first one is remembered", async () => {
    const order = await verifiedOrder((await makePatient({ phone: ph("0022") })).id);
    const token = tokenOf((await action(order.id, { action: "release" })).json.report.link);
    const before = await prisma.labReport.findUniqueOrThrow({ where: { accessToken: token } });
    expect([before.viewCount, before.firstViewedAt]).toEqual([0, null]);
    await open(token, "0022");
    await open(token, "0022");
    const after = await prisma.labReport.findUniqueOrThrow({ where: { accessToken: token } });
    expect(after.viewCount).toBe(2);
    expect(after.firstViewedAt).toBeInstanceOf(Date);
    expect((await view(order.id)).json.report.viewCount).toBe(2);
  });

  it("stops guessing after a few wrong tries, but never stops the patient opening their own report", async () => {
    const order = await verifiedOrder((await makePatient({ phone: ph("0033") })).id);
    const token = tokenOf((await action(order.id, { action: "release" })).json.report.link);
    // The right PIN used again and again is never counted against the patient.
    for (let i = 0; i < 9; i += 1) expect((await open(token, "0033")).status).toBe(200);
    // Five wrong guesses are allowed; after that the link is locked, even for the right PIN.
    for (let i = 0; i < 5; i += 1) expect((await open(token, `10${i}0`)).status).toBe(403);
    const locked = await open(token, "0033");
    expect(locked.status).toBe(429);
    expect(locked.json.error).toMatch(/wait/i);
  });

  it("locks one link without touching another", async () => {
    const one = tokenOf((await action((await verifiedOrder((await makePatient({ phone: ph("0044") })).id)).id, { action: "release" })).json.report.link);
    const two = tokenOf((await action((await verifiedOrder((await makePatient({ phone: ph("0055") })).id)).id, { action: "release" })).json.report.link);
    for (let i = 0; i < 6; i += 1) await open(one, "9999");
    expect((await open(one, "0044")).status).toBe(429);
    expect((await open(two, "0055")).status).toBe(200);
  });

  it("limits one address that tries many links", async () => {
    const ip = "203.0.113.200";
    const order = await verifiedOrder((await makePatient({ phone: ph("0066") })).id);
    const token = tokenOf((await action(order.id, { action: "release" })).json.report.link);
    const statuses: number[] = [];
    for (let i = 0; i < 24; i += 1) statuses.push((await open(token, "0000", ip)).status);
    expect(statuses).toContain(429);
  });

  it("cannot be opened online when the phone number is too short to make a PIN", async () => {
    const patient = await makePatient({ phone: "12345" });
    const order = await verifiedOrder(patient.id);
    const { report } = (await action(order.id, { action: "release" })).json;
    expect((await view(order.id)).json.pinHint).toBe(false);
    expect((await open(tokenOf(report.link), "2345")).status).toBe(403);
    const sent = await send(order.id, "sms");
    expect(sent.status).toBe(422);
    expect(sent.json.message).toMatch(/too short/);
    expect(sendSms).not.toHaveBeenCalled();
  });
});

describe("withdrawing and correcting a report", () => {
  it("needs a reason and the right permission, and takes the report back at once", async () => {
    const patient = await makePatient({ phone: ph("1122") });
    const order = await verifiedOrder(patient.id);
    const token = tokenOf((await action(order.id, { action: "release" })).json.report.link);

    expect((await action(order.id, { action: "withdraw", reason: "x" })).status).toBe(400);
    expect((await action(order.id, { action: "withdraw", reason: "Wrong result entered" }, receptionist.cookie)).status).toBe(403);
    const withdrawn = await action(order.id, { action: "withdraw", reason: "Wrong result entered" });
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.json).toMatchObject({ status: "VERIFIED", report: null });
    expect(withdrawn.json.history[0]).toMatchObject({ status: "WITHDRAWN", withdrawReason: "Wrong result entered" });

    const gone = await open(token, "1122");
    expect(gone.status).toBe(410);
    expect(gone.json.report).toBeUndefined();
    expect(gone.json.error).toMatch(/withdrawn/i);
    expect((await action(order.id, { action: "withdraw", reason: "Again please" })).status).toBe(409);
    expect((await prisma.auditEvent.count({ where: { action: "WITHDRAW", entity: "LabReport" } }))).toBeGreaterThan(0);
  });

  it("releases a corrected version with a new link, and the old link stays dead", async () => {
    const patient = await makePatient({ phone: ph("1133") });
    const order = await verifiedOrder(patient.id, ["glucose"], { Glucose: "300" });
    const first = (await action(order.id, { action: "release" })).json.report;
    await action(order.id, { action: "withdraw", reason: "Typing error, should be 90" });

    expect((await review(order.id, { action: "return", itemId: itemOf(order, "glucose"), reason: "Fix the value" })).status).toBe(200);
    expect((await enter(itemOf(order, "glucose"), { values: [{ name: "Glucose", value: "90" }] })).status).toBe(200);
    expect((await review(order.id, { action: "verify" })).json.order.status).toBe("VERIFIED");

    const second = (await action(order.id, { action: "release" })).json.report;
    expect(second.version).toBe(2);
    expect(second.reportCode).not.toBe(first.reportCode);
    expect(tokenOf(second.link)).not.toBe(tokenOf(first.link));
    expect(second.snapshot.tests[0].parameters[0]).toMatchObject({ value: "90", flag: "NORMAL" });

    expect((await open(tokenOf(first.link), "1133")).status).toBe(410);
    const fresh = await open(tokenOf(second.link), "1133");
    expect(fresh.json.report.snapshot.tests[0].parameters[0].value).toBe("90");

    const history = (await view(order.id)).json.history;
    expect(history.map((entry: { version: number; status: string }) => [entry.version, entry.status])).toEqual([[2, "ISSUED"], [1, "WITHDRAWN"]]);
    expect(await lookupVerification(first.verifyCode)).toMatchObject({ status: "WITHDRAWN" });
    expect(await lookupVerification(second.verifyCode)).toMatchObject({ status: "ISSUED", version: 2 });
  });
});

describe("checking a report is genuine", () => {
  it("confirms a real code without revealing any result, and masks the name", async () => {
    const patient = await makePatient({ name: "Rahim Uddin" });
    const order = await verifiedOrder(patient.id);
    const { report } = (await action(order.id, { action: "release" })).json;

    const found = await lookupVerification(report.verifyCode);
    expect(found).toMatchObject({ reportCode: report.reportCode, status: "ISSUED", version: 1, patient: "R**** U****", tests: 1 });
    expect(JSON.stringify(found)).not.toMatch(/Rahim|Uddin|105|Glucose|mg\/dL/);

    // Typed by hand, with dashes and lower case, it is found all the same.
    expect(await lookupVerification(formatVerifyCode(report.verifyCode).toLowerCase())).toMatchObject({ reportCode: report.reportCode });
    expect(await lookupVerification("AAAA-AAAA-AAAA")).toBeNull();
    expect(await lookupVerification("not a code")).toBeNull();
    expect(await lookupVerification("")).toBeNull();
  });
});

describe("sending the link", () => {
  it("texts the patient the link with the PIN hint, and remembers when", async () => {
    const patient = await makePatient({ name: "Nasrin Akter", phone: ph("4433") });
    const order = await verifiedOrder(patient.id);
    const { report } = (await action(order.id, { action: "release" })).json;

    const sent = await send(order.id, "sms");
    expect(sent.status).toBe(200);
    expect(sent.json.ok).toBe(true);
    expect(sendSms).toHaveBeenCalledTimes(1);
    const call0 = sendSms.mock.calls[0][0];
    expect(call0.to).toBe(patient.phone);
    expect(call0.text).toContain(report.link);
    expect(call0.text).toMatch(/last 4 digits/);
    expect(call0.text).toContain("Dear Nasrin,");
    expect(call0.text).not.toMatch(/Glucose|105|Akter/); // no results, no surname
    expect(call0.actorId).toBe(receptionist.id);
    expect(sent.json.view.report.smsSentAt).toBeTruthy();
    expect((await prisma.auditEvent.count({ where: { action: "SEND_SMS", entityId: report.id } }))).toBe(1);
  });

  it("tells the person why a text could not be sent, and does not pretend it did", async () => {
    const order = await verifiedOrder((await makePatient({ phone: ph("4455") })).id);
    await action(order.id, { action: "release" });
    sendSms.mockImplementationOnce(async () => ({ ok: false, message: "SMS is turned off. Turn it on in SMS settings." }));
    const failed = await send(order.id, "sms");
    expect(failed.status).toBe(422);
    expect(failed.json).toMatchObject({ ok: false, message: expect.stringMatching(/turned off/) });
    expect(failed.json.view.report.smsSentAt).toBeNull();
    expect((await prisma.auditEvent.count({ where: { action: "SEND_SMS", entityId: failed.json.view.report.id } }))).toBe(0);
  });

  it("e-mails the link when the patient has an address, and explains when they have none", async () => {
    const withMail = await verifiedOrder((await makePatient({ phone: ph("4466"), email: "nasrin@example.test" })).id);
    await action(withMail.id, { action: "release" });
    expect((await view(withMail.id)).json.canEmail).toBe(true);
    const sent = await send(withMail.id, "email");
    expect(sent.status).toBe(200);
    const [to, content, audit] = sendEmail.mock.calls[0] as [string, { html: string; text: string }, { action: string }];
    expect(to).toBe("nasrin@example.test");
    expect(content.text).toMatch(/\/r\//);
    expect(audit.action).toBe("REPORT_READY");
    expect(sent.json.view.report.emailSentAt).toBeTruthy();

    const without = await verifiedOrder((await makePatient({ phone: ph("4477") })).id);
    await action(without.id, { action: "release" });
    const none = await send(without.id, "email");
    expect(none.status).toBe(422);
    expect(none.json.message).toMatch(/no e-mail/i);
  });

  it("reports an e-mail that is turned off or refused", async () => {
    const order = await verifiedOrder((await makePatient({ phone: ph("4488"), email: "off@example.test" })).id);
    await action(order.id, { action: "release" });
    sendEmail.mockImplementationOnce(async () => ({ ok: false, code: "DISABLED", message: "E-mail is turned off." }));
    expect((await send(order.id, "email")).json.message).toMatch(/turned off/);
    sendEmail.mockImplementationOnce(async () => ({ ok: false, code: "EAUTH", message: "Login to the mail server failed." }));
    expect((await send(order.id, "email")).json.message).toMatch(/Login/);
  });

  it("refuses before release, for a bad channel, and for people who may not send", async () => {
    const order = await verifiedOrder((await makePatient({ phone: ph("4499") })).id);
    expect((await send(order.id, "sms")).json.message).toMatch(/Release the report first/);
    await action(order.id, { action: "release" });
    expect((await send(order.id, "pigeon")).status).toBe(400);
    expect((await send(order.id, "sms", (await createSession("accountant")).cookie)).status).toBe(403);
    expect(sendSms).not.toHaveBeenCalled();
  });
});
