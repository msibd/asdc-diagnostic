import { beforeAll, describe, expect, it } from "vitest";
import { POST as createOrder } from "@/app/api/orders/route";
import { POST as reviewOrder } from "@/app/api/orders/[id]/review/route";
import { GET as getSheet } from "@/app/api/orders/[id]/results/route";
import { GET as getAck, POST as postAck } from "@/app/api/orders/[id]/critical-ack/route";
import { PATCH as changeSample } from "@/app/api/samples/[id]/route";
import { PUT as putResults } from "@/app/api/results/[itemId]/route";
import { prisma } from "@/lib/prisma";
import { call, createSession, patientInput, type TestUser } from "./helpers";

let admin: TestUser;
let receptionist: TestUser;
let lab: TestUser;
let pathologist: TestUser;
let man = "";
let woman = "";
let unknownSex = "";
const run = Date.now().toString(36).toUpperCase();
let counter = 0;
const ids: Record<string, string> = {};

const code = (prefix: string) => `${prefix}${run}${counter++}`;
const born = (yearsAgo: number) => new Date(Date.now() - yearsAgo * 365.25 * 86_400_000);

const makePatient = async (sex: "MALE" | "FEMALE" | null, age: number | null) =>
  (await prisma.patient.create({ data: { ...patientInput(), patientCode: code("PID-R"), sex, dateOfBirth: age === null ? null : born(age) } })).id;

type RangeSeed = { sex?: "ANY" | "MALE" | "FEMALE"; low?: number; high?: number; criticalLow?: number; criticalHigh?: number; note?: string };
const makeTest = async (key: string, parameters: [string, string | null, RangeSeed[]][], sampleType: string | null = "Blood") => {
  const row = await prisma.clinicService.create({
    data: {
      code: code("R"), name: `Result ${key} ${run}`, kind: "TEST", sampleType, standardPrice: 100, durationMinutes: 15,
      parameters: { create: parameters.map(([name, unit, ranges], index) => ({ name, unit, sortOrder: index, ranges: { create: ranges.map((range) => ({ sex: range.sex ?? "ANY", low: range.low ?? null, high: range.high ?? null, criticalLow: range.criticalLow ?? null, criticalHigh: range.criticalHigh ?? null, note: range.note ?? null })) } })) },
    },
  });
  ids[key] = row.id;
  return row;
};

const sample = (id: string, action: string) => call(changeSample, `/api/samples/${id}`, { method: "PATCH", body: { action }, cookie: lab.cookie, params: { id } });

/** Places an order and walks every sample to "received", so results can be entered. */
async function readyOrder(patientId: string, serviceIds: string[]) {
  const placed = await call(createOrder, "/api/orders", { method: "POST", body: { patientId, serviceIds }, cookie: receptionist.cookie });
  expect(placed.status).toBe(201);
  let order = placed.json.order;
  for (const entry of order.samples) {
    await sample(entry.id, "collect");
    order = (await sample(entry.id, "receive")).json.order;
  }
  return order as { id: string; status: string; items: { id: string; testCode: string; testId: string }[]; samples: unknown[] };
}

const itemOf = (order: { items: { id: string; testId: string }[] }, key: string) => order.items.find((item) => item.testId === ids[key])!.id;
const sheet = (orderId: string, cookie = admin.cookie) => call(getSheet, `/api/orders/${orderId}/results`, { cookie, params: { id: orderId } });
const enter = (itemId: string, body: Record<string, unknown>, cookie = lab.cookie) => call(putResults, `/api/results/${itemId}`, { method: "PUT", body, cookie, params: { itemId } });
const review = (orderId: string, body: Record<string, unknown>, cookie = pathologist.cookie) => call(reviewOrder, `/api/orders/${orderId}/review`, { method: "POST", body, cookie, params: { id: orderId } });
const values = (map: Record<string, string>) => ({ values: Object.entries(map).map(([name, value]) => ({ name, value })) });
const resultRows = (itemId: string) => prisma.testResult.findMany({ where: { itemId }, orderBy: { sortOrder: "asc" } });

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  lab = await createSession("lab_staff");
  pathologist = await createSession("pathologist");
  man = await makePatient("MALE", 40);
  woman = await makePatient("FEMALE", 40);
  unknownSex = await makePatient(null, 40);
  await makeTest("hb", [
    ["Haemoglobin", "g/dL", [{ sex: "MALE", low: 13, high: 17, criticalLow: 7 }, { sex: "FEMALE", low: 12, high: 15, criticalLow: 7 }]],
    ["WBC", "x10³/µL", [{ low: 4, high: 11, criticalHigh: 30 }]],
  ]);
  await makeTest("glucose", [["Glucose", "mg/dL", [{ low: 70, high: 100, criticalLow: 40, criticalHigh: 500 }]]]);
  await makeTest("dengue", [["NS1 antigen", null, [{ note: "Negative" }]]], "Serum");
  await makeTest("hbonly", [["Haemoglobin only", "g/dL", [{ sex: "MALE", low: 13, high: 17 }, { sex: "FEMALE", low: 12, high: 15 }]]]);
  await makeTest("norange", [["Reading", "units", []]]);
  await makeTest("freetext", [], "Fluid");
});

describe("the entry sheet", () => {
  it("shows the range that fits each patient's sex", async () => {
    const forMan = await readyOrder(man, [ids.hb]);
    const forWoman = await readyOrder(woman, [ids.hb]);
    const hbOf = async (orderId: string) => (await sheet(orderId)).json.sheet.items[0].parameters[0];
    expect((await hbOf(forMan.id)).range).toMatchObject({ sex: "MALE", low: 13, high: 17 });
    expect((await hbOf(forWoman.id)).range).toMatchObject({ sex: "FEMALE", low: 12, high: 15 });
    expect((await hbOf(forMan.id)).referenceText).toBe("13 – 17");
    expect((await hbOf(forWoman.id)).referenceText).toBe("12 – 15");
  });

  it("explains instead of guessing when the sex is not recorded", async () => {
    const order = await readyOrder(unknownSex, [ids.hbonly]);
    const parameter = (await sheet(order.id)).json.sheet.items[0].parameters[0];
    expect(parameter.range).toBeNull();
    expect(parameter.rangeProblem).toMatch(/sex is not recorded/i);
  });

  it("returns 404 for a missing order, and is readable by anyone who can read orders", async () => {
    expect((await sheet("none")).status).toBe(404);
    const order = await readyOrder(man, [ids.glucose]);
    expect((await sheet(order.id, receptionist.cookie)).status).toBe(200);
    expect((await sheet(order.id, "")).status).toBeGreaterThanOrEqual(401);
  });
});

describe("entering results", () => {
  it("flags the same value differently for a man and a woman", async () => {
    const forMan = await readyOrder(man, [ids.hb]);
    const forWoman = await readyOrder(woman, [ids.hb]);
    const typed = values({ Haemoglobin: "12.4", WBC: "6.5" });
    expect((await enter(itemOf(forMan, "hb"), typed)).status).toBe(200);
    expect((await enter(itemOf(forWoman, "hb"), typed)).status).toBe(200);
    const flagFor = async (order: { items: { id: string; testId: string }[] }) => (await resultRows(itemOf(order, "hb"))).map((row) => [row.parameterName, row.flag, row.referenceText]);
    expect(await flagFor(forMan)).toEqual([["Haemoglobin", "LOW", "13 – 17"], ["WBC", "NORMAL", "4 – 11"]]);
    expect(await flagFor(forWoman)).toEqual([["Haemoglobin", "NORMAL", "12 – 15"], ["WBC", "NORMAL", "4 – 11"]]);
  });

  it("flags critical values and records how many in the audit log", async () => {
    const order = await readyOrder(man, [ids.hb]);
    const item = itemOf(order, "hb");
    expect((await enter(item, values({ Haemoglobin: "6.2", WBC: "45" }))).status).toBe(200);
    expect((await resultRows(item)).map((row) => row.flag)).toEqual(["CRITICAL_LOW", "CRITICAL_HIGH"]);
    const event = await prisma.auditEvent.findFirst({ where: { entity: "TestOrderItem", action: "ENTER", entityId: item } });
    expect(event?.details).toMatchObject({ critical: 2, values: 2 });
    expect(event?.actorId).toBe(lab.id);
  });

  it("stores exactly what was typed and the number it was read as", async () => {
    const order = await readyOrder(man, [ids.glucose]);
    const item = itemOf(order, "glucose");
    await enter(item, values({ Glucose: " 85.50 " }));
    const [row] = await resultRows(item);
    expect(row).toMatchObject({ value: "85.50", flag: "NORMAL" });
    expect(Number(row.numericValue)).toBe(85.5);
  });

  it("reads a text result against a text range", async () => {
    const order = await readyOrder(man, [ids.dengue]);
    const item = itemOf(order, "dengue");
    await enter(item, values({ "NS1 antigen": "negative" }));
    expect((await resultRows(item))[0]).toMatchObject({ flag: "NORMAL", referenceText: "Negative" });
    await enter(item, values({ "NS1 antigen": "Positive" }));
    expect((await resultRows(item))[0].flag).toBe("ABNORMAL");
  });

  it("keeps a value with no flag when no range applies", async () => {
    const order = await readyOrder(unknownSex, [ids.hbonly]);
    const item = itemOf(order, "hbonly");
    expect((await enter(item, values({ "Haemoglobin only": "9.1" }))).status).toBe(200);
    expect((await resultRows(item))[0]).toMatchObject({ value: "9.1", flag: null, referenceText: null });
  });

  it("accepts a parameter that has no range at all", async () => {
    const order = await readyOrder(man, [ids.norange]);
    expect((await enter(itemOf(order, "norange"), values({ Reading: "42" }))).status).toBe(200);
  });

  it("lets some parameters stay blank but not all", async () => {
    const order = await readyOrder(man, [ids.hb]);
    const item = itemOf(order, "hb");
    expect((await enter(item, values({ Haemoglobin: "14", WBC: "" }))).status).toBe(200);
    expect(await resultRows(item)).toHaveLength(1);
    const none = await enter(item, values({ Haemoglobin: " ", WBC: "" }));
    expect(none.status).toBe(400);
    expect(none.json.error).toMatch(/at least one/i);
    expect(await resultRows(item)).toHaveLength(1); // the failed save changed nothing
  });

  it.each([
    ["a non-number", { Haemoglobin: "abc" }, /must be a number/],
    ["a number with a comma", { Haemoglobin: "1,2" }, /must be a number/],
    ["a comparison sign", { Haemoglobin: "<5" }, /must be a number/],
    ["an unknown parameter", { Pulse: "70" }, /not a parameter/],
  ])("refuses %s", async (_label, typed, message) => {
    const order = await readyOrder(man, [ids.hb]);
    const result = await enter(itemOf(order, "hb"), values(typed));
    expect(result.status).toBe(400);
    expect(result.json.error).toMatch(message);
    expect(await resultRows(itemOf(order, "hb"))).toHaveLength(0);
  });

  it("needs the written result for a test with no parameters", async () => {
    const order = await readyOrder(man, [ids.freetext]);
    const item = itemOf(order, "freetext");
    expect((await enter(item, { text: "  " })).status).toBe(400);
    expect((await enter(item, { text: "No growth after 48 hours", note: "Repeat if fever persists" })).status).toBe(200);
    const stored = await prisma.testOrderItem.findUniqueOrThrow({ where: { id: item } });
    expect(stored).toMatchObject({ resultStatus: "ENTERED", resultText: "No growth after 48 hours", resultNote: "Repeat if fever persists", enteredBy: expect.any(String) });
  });

  it("can be edited until approved, replacing the old values", async () => {
    const order = await readyOrder(man, [ids.hb]);
    const item = itemOf(order, "hb");
    await enter(item, values({ Haemoglobin: "10", WBC: "6" }));
    await enter(item, values({ Haemoglobin: "15" }));
    const rows = await resultRows(item);
    expect(rows.map((row) => [row.parameterName, row.value, row.flag])).toEqual([["Haemoglobin", "15", "NORMAL"]]);
  });

  it("refuses until every sample is in the lab", async () => {
    const placed = (await call(createOrder, "/api/orders", { method: "POST", body: { patientId: man, serviceIds: [ids.glucose] }, cookie: receptionist.cookie })).json.order;
    const early = await enter(placed.items[0].id, values({ Glucose: "90" }));
    expect(early.status).toBe(409);
    expect(early.json.error).toMatch(/every sample/i);
  });

  it("is limited to people who may enter results", async () => {
    const order = await readyOrder(man, [ids.glucose]);
    const item = itemOf(order, "glucose");
    expect((await enter(item, values({ Glucose: "90" }), receptionist.cookie)).status).toBe(403);
    expect((await enter(item, values({ Glucose: "90" }), pathologist.cookie)).status).toBe(200);
    expect((await enter("missing", values({ Glucose: "90" }))).status).toBe(404);
  });

  it("moves the order through in process and result entered as tests are done", async () => {
    const order = await readyOrder(man, [ids.glucose, ids.dengue]);
    const status = async () => (await prisma.testOrder.findUniqueOrThrow({ where: { id: order.id } })).status;
    expect(await status()).toBe("RECEIVED");
    await enter(itemOf(order, "glucose"), values({ Glucose: "90" }));
    expect(await status()).toBe("IN_PROCESS");
    await enter(itemOf(order, "dengue"), values({ "NS1 antigen": "Negative" }));
    expect(await status()).toBe("RESULT_ENTERED");
  });

  it("locks the samples once results exist", async () => {
    const order = await readyOrder(man, [ids.glucose]);
    await enter(itemOf(order, "glucose"), values({ Glucose: "90" }));
    const firstSample = (await prisma.sample.findFirstOrThrow({ where: { orderId: order.id } })).id;
    expect((await call(changeSample, `/api/samples/${firstSample}`, { method: "PATCH", body: { action: "reject", reason: "Too late" }, cookie: lab.cookie, params: { id: firstSample } })).status).toBe(409);
  });
});

describe("approval by the pathologist", () => {
  it("approves one test or everything waiting, and only the pathologist may", async () => {
    const order = await readyOrder(man, [ids.glucose, ids.dengue]);
    await enter(itemOf(order, "glucose"), values({ Glucose: "90" }));
    await enter(itemOf(order, "dengue"), values({ "NS1 antigen": "Negative" }));

    expect((await review(order.id, { action: "verify" }, lab.cookie)).status).toBe(403);
    expect((await review(order.id, { action: "verify" }, receptionist.cookie)).status).toBe(403);

    const one = await review(order.id, { action: "verify", itemId: itemOf(order, "glucose") });
    expect(one.status).toBe(200);
    expect(one.json.order.status).toBe("RESULT_ENTERED");
    const glucose = one.json.sheet.items.find((entry: { testId: string }) => entry.testId === ids.glucose);
    expect(glucose).toMatchObject({ resultStatus: "VERIFIED", verifiedBy: expect.any(String) });

    const rest = await review(order.id, { action: "verify" });
    expect(rest.json.order.status).toBe("VERIFIED");
    expect(rest.json.sheet.items.every((entry: { resultStatus: string }) => entry.resultStatus === "VERIFIED")).toBe(true);
    expect((await prisma.auditEvent.count({ where: { action: "VERIFY", entity: "TestOrderItem", entityId: { in: order.items.map((item) => item.id) } } }))).toBe(2);
  });

  it("refuses to approve when nothing is waiting", async () => {
    const order = await readyOrder(man, [ids.glucose]);
    expect((await review(order.id, { action: "verify" })).status).toBe(409); // nothing entered yet
    await enter(itemOf(order, "glucose"), values({ Glucose: "90" }));
    expect((await review(order.id, { action: "verify" })).status).toBe(200);
    expect((await review(order.id, { action: "verify" })).status).toBe(409); // already approved
  });

  it("locks an approved test against editing", async () => {
    const order = await readyOrder(man, [ids.glucose]);
    const item = itemOf(order, "glucose");
    await enter(item, values({ Glucose: "90" }));
    await review(order.id, { action: "verify" });
    const edit = await enter(item, values({ Glucose: "95" }), admin.cookie);
    expect(edit.status).toBe(409);
    expect(edit.json.error).toMatch(/approved|pathologist/i);
    expect((await resultRows(item))[0].value).toBe("90");
  });

  it("sends a test back with a reason, keeps its values, and lets the lab correct it", async () => {
    const order = await readyOrder(man, [ids.glucose, ids.dengue]);
    const item = itemOf(order, "glucose");
    await enter(item, values({ Glucose: "900" }));
    await enter(itemOf(order, "dengue"), values({ "NS1 antigen": "Negative" }));
    await review(order.id, { action: "verify" });

    expect((await review(order.id, { action: "return", itemId: item, reason: "" })).status).toBe(400);
    expect((await review(order.id, { action: "return", reason: "Looks wrong" })).status).toBe(400);
    const sent = await review(order.id, { action: "return", itemId: item, reason: "Value looks like a typing error" });
    expect(sent.status).toBe(200);
    expect(sent.json.order.status).toBe("IN_PROCESS");
    const back = sent.json.sheet.items.find((entry: { itemId: string }) => entry.itemId === item);
    expect(back).toMatchObject({ resultStatus: "PENDING", returnReason: "Value looks like a typing error", verifiedBy: null });
    expect(back.parameters[0].value).toBe("900"); // kept so the technician can fix it

    expect((await enter(item, values({ Glucose: "90" }))).status).toBe(200);
    const fixed = await sheet(order.id);
    expect(fixed.json.sheet.items.find((entry: { itemId: string }) => entry.itemId === item)).toMatchObject({ resultStatus: "ENTERED", returnReason: null });
    expect(fixed.json.sheet.status).toBe("RESULT_ENTERED");
    expect((await review(order.id, { action: "verify" })).json.order.status).toBe("VERIFIED");
  });

  it("can reopen an approved test", async () => {
    const order = await readyOrder(man, [ids.glucose]);
    const item = itemOf(order, "glucose");
    await enter(item, values({ Glucose: "90" }));
    await review(order.id, { action: "verify" });
    const reopened = await review(order.id, { action: "return", itemId: item, reason: "Sample mix-up suspected" });
    expect(reopened.json.order.status).toBe("RECEIVED");
    expect((await prisma.auditEvent.count({ where: { action: "RETURN", entityId: item } }))).toBe(1);
  });

  it("will not review an order with no results, or a cancelled one", async () => {
    const order = await readyOrder(man, [ids.glucose]);
    expect((await review(order.id, { action: "return", itemId: itemOf(order, "glucose"), reason: "Nothing to return" })).status).toBe(409);
    expect((await review("missing", { action: "verify" })).status).toBe(404);
    await prisma.testOrder.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    expect((await review(order.id, { action: "verify" })).status).toBe(409);
  });

  it("refuses changes once the report has been delivered", async () => {
    const order = await readyOrder(man, [ids.glucose]);
    const item = itemOf(order, "glucose");
    await enter(item, values({ Glucose: "90" }));
    await review(order.id, { action: "verify" });
    await prisma.testOrder.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
    expect((await review(order.id, { action: "return", itemId: item, reason: "Too late now" })).status).toBe(409);
    expect((await enter(item, values({ Glucose: "91" }), admin.cookie)).status).toBe(409);
  });
});

describe("an issued result never changes by itself", () => {
  it("keeps the saved name, unit and reference text when the catalog is edited afterwards", async () => {
    const order = await readyOrder(man, [ids.glucose]);
    const item = itemOf(order, "glucose");
    await enter(item, values({ Glucose: "105" }));
    const before = (await resultRows(item))[0];
    expect(before).toMatchObject({ flag: "HIGH", referenceText: "70 – 100", unit: "mg/dL" });

    // The catalog is changed after the result was saved: new limits and a renamed parameter.
    const parameter = await prisma.testParameter.findFirstOrThrow({ where: { testId: ids.glucose } });
    await prisma.testReferenceRange.updateMany({ where: { parameterId: parameter.id }, data: { low: 60, high: 110 } });
    await prisma.testParameter.update({ where: { id: parameter.id }, data: { name: "Blood glucose", unit: "mmol/L" } });

    const after = (await resultRows(item))[0];
    expect(after).toMatchObject({ parameterName: "Glucose", unit: "mg/dL", flag: "HIGH", referenceText: "70 – 100", value: "105" });
    // The sheet still shows the old result (as retired) next to the renamed parameter.
    const shown = (await sheet(order.id)).json.sheet.items[0].parameters;
    expect(shown.find((entry: { name: string }) => entry.name === "Glucose")).toMatchObject({ retired: true, value: "105", flag: "HIGH" });
  });
});

describe("critical result acknowledgement", () => {
  const ack = (id: string, body: unknown, cookie = lab.cookie) => call(postAck, `/api/orders/${id}/critical-ack`, { method: "POST", body, cookie, params: { id } });

  it("records who was told, and shows it on the next read", async () => {
    const order = await readyOrder(man, [ids.hb]);
    await enter(itemOf(order, "hb"), values({ Haemoglobin: "6.2", WBC: "10" }));
    expect((await call(getAck, `/api/orders/${order.id}/critical-ack`, { cookie: lab.cookie, params: { id: order.id } })).json.acknowledgement).toBeFalsy();
    expect((await ack(order.id, { informedPerson: "Dr Rahman (referring doctor)" })).status).toBe(201);
    const read = await call(getAck, `/api/orders/${order.id}/critical-ack`, { cookie: receptionist.cookie, params: { id: order.id } });
    expect(read.json.acknowledgement).toMatchObject({ informedPerson: "Dr Rahman (referring doctor)", by: "Test lab_staff" });
  });

  it("refuses an order with no critical result, a missing name, or a user who cannot enter results", async () => {
    const calm = await readyOrder(man, [ids.hb]);
    await enter(itemOf(calm, "hb"), values({ Haemoglobin: "14", WBC: "6" }));
    expect((await ack(calm.id, { informedPerson: "Dr Rahman" })).status).toBe(409);
    const critical = await readyOrder(man, [ids.hb]);
    await enter(itemOf(critical, "hb"), values({ Haemoglobin: "6.2", WBC: "10" }));
    expect((await ack(critical.id, { informedPerson: " " })).status).toBe(400);
    expect((await ack(critical.id, { informedPerson: "Dr Rahman" }, receptionist.cookie)).status).toBe(403);
    expect((await ack("none", { informedPerson: "Dr Rahman" })).status).toBe(404);
  });
});
