import { beforeAll, describe, expect, it } from "vitest";
import { GET as listOrders, POST as createOrder } from "@/app/api/orders/route";
import { GET as getOrder } from "@/app/api/orders/[id]/route";
import { POST as cancelOrder } from "@/app/api/orders/[id]/cancel/route";
import { PATCH as changeSample } from "@/app/api/samples/[id]/route";
import { POST as scanSample } from "@/app/api/samples/scan/route";
import { prisma } from "@/lib/prisma";
import {
  canCancelOrder, deriveOrderStatus, groupBySample, normaliseSampleType, planOrder,
  type CatalogRow, type OrderStatus, type SampleState,
} from "@/modules/orders/services/order-rules";
import { ageText, sampleSummary, type OrderSample } from "@/modules/orders/components/order-types";
import { call, createSession, patientInput, type TestUser } from "./helpers";

// ---------------------------------------------------------------- pure rules

const test = (id: string, sampleType: string | null, price = 100, over: Partial<CatalogRow> = {}): CatalogRow =>
  ({ id, code: id.toUpperCase(), name: `Test ${id}`, kind: "TEST", isActive: true, standardPrice: price, sampleType, members: [], ...over });
const panel = (id: string, members: CatalogRow[], price: number, over: Partial<CatalogRow> = {}): CatalogRow =>
  ({ id, code: id.toUpperCase(), name: `Panel ${id}`, kind: "PANEL", isActive: true, standardPrice: price, sampleType: null,
    members: members.map((member) => ({ id: member.id, code: member.code, name: member.name, sampleType: member.sampleType, isActive: member.isActive })), ...over });

describe("sample type normalisation (pure)", () => {
  it.each([["Blood", "Blood"], [" blood ", "Blood"], ["URINE", "Urine"], ["None", null], ["none", null], ["", null], [null, null], [undefined, null]])(
    "%j -> %j", (input, expected) => expect(normaliseSampleType(input as string | null | undefined)).toBe(expected));
});

describe("planOrder (pure)", () => {
  it("bills each picked item once and lists the tests to perform", () => {
    const result = planOrder([test("a", "Blood", 300), test("b", "Urine", 150)]);
    expect("plan" in result && result.plan.invoiceItems.map((item) => [item.description, item.unitPrice])).toEqual([["Test a", 300], ["Test b", 150]]);
    expect("plan" in result && result.plan.tests.map((entry) => entry.testId)).toEqual(["a", "b"]);
  });

  it("expands a panel into its tests but bills only the panel price", () => {
    const a = test("a", "Blood"); const b = test("b", "Blood");
    const result = planOrder([panel("p", [a, b], 450)]);
    if (!("plan" in result)) throw new Error(result.error);
    expect(result.plan.invoiceItems).toEqual([{ serviceId: "p", description: "Panel p", quantity: 1, unitPrice: 450 }]);
    expect(result.plan.tests.map((entry) => [entry.testId, entry.panelId])).toEqual([["a", "p"], ["b", "p"]]);
  });

  it("bills a plain service without anything to perform", () => {
    const result = planOrder([{ ...test("h", null, 200), kind: "SERVICE" }]);
    if (!("plan" in result)) throw new Error(result.error);
    expect(result.plan.invoiceItems).toHaveLength(1);
    expect(result.plan.tests).toHaveLength(0);
  });

  it("refuses a test that is also inside a picked panel", () => {
    const a = test("a", "Blood");
    const result = planOrder([a, panel("p", [a, test("b", "Blood")], 400)]);
    expect("error" in result && result.error).toMatch(/already included in/);
  });

  it("refuses the same test arriving through two panels", () => {
    const a = test("a", "Blood");
    const result = planOrder([panel("p1", [a, test("b", "Blood")], 400), panel("p2", [a, test("c", "Blood")], 400)]);
    expect("error" in result && result.error).toMatch(/already included in/);
  });

  it("refuses empty orders, repeated picks, disabled items and empty or disabled-member panels", () => {
    expect("error" in planOrder([])).toBe(true);
    expect("error" in planOrder([test("a", "Blood"), test("a", "Blood")])).toBe(true);
    expect("error" in planOrder([test("a", "Blood", 100, { isActive: false })])).toBe(true);
    expect("error" in planOrder([panel("p", [], 100)])).toBe(true);
    expect("error" in planOrder([panel("p", [{ ...test("a", "Blood"), isActive: false }], 100)])).toBe(true);
  });
});

describe("groupBySample (pure)", () => {
  it("puts tests that need the same sample together and keeps no-sample tests apart", () => {
    const result = planOrder([test("a", "Blood"), test("b", "blood"), test("c", "Urine"), test("d", "None")]);
    if (!("plan" in result)) throw new Error(result.error);
    const { groups, withoutSample } = groupBySample(result.plan.tests);
    expect([...groups.keys()].sort()).toEqual(["Blood", "Urine"]);
    expect(groups.get("Blood")).toHaveLength(2);
    expect(withoutSample.map((entry) => entry.testId)).toEqual(["d"]);
  });
});

describe("deriveOrderStatus (pure)", () => {
  const s = (...states: SampleState[]) => states.map((status) => ({ status }));
  it.each<[OrderStatus, SampleState[], OrderStatus]>([
    ["ORDERED", [], "RECEIVED"],
    ["ORDERED", ["PENDING"], "ORDERED"],
    ["ORDERED", ["COLLECTED", "PENDING"], "ORDERED"],
    ["ORDERED", ["COLLECTED", "COLLECTED"], "SAMPLE_COLLECTED"],
    ["SAMPLE_COLLECTED", ["COLLECTED", "RECEIVED"], "SAMPLE_COLLECTED"],
    ["SAMPLE_COLLECTED", ["RECEIVED", "RECEIVED"], "RECEIVED"],
    ["RECEIVED", ["RECEIVED", "PENDING"], "ORDERED"],
    ["RECEIVED", ["REJECTED", "RECEIVED"], "RECEIVED"],
    ["RECEIVED", ["REJECTED", "PENDING"], "ORDERED"],
    ["IN_PROCESS", ["PENDING"], "IN_PROCESS"],
    ["VERIFIED", [], "VERIFIED"],
    ["CANCELLED", ["PENDING"], "CANCELLED"],
  ])("%s with %j -> %s", (current, states, expected) => expect(deriveOrderStatus(current, s(...states))).toBe(expected));

  it("allows cancelling only before result entry", () => {
    expect(["ORDERED", "SAMPLE_COLLECTED", "RECEIVED"].every((status) => canCancelOrder(status as OrderStatus))).toBe(true);
    expect(["IN_PROCESS", "RESULT_ENTERED", "VERIFIED", "DELIVERED", "CANCELLED"].some((status) => canCancelOrder(status as OrderStatus))).toBe(false);
  });
});

describe("screen helpers (pure)", () => {
  const today = new Date("2026-11-08T10:00:00Z");
  it.each([
    ["1990-11-08", "36 y"], ["1990-11-09", "35 y"], ["2026-05-08", "6 mo"], ["2026-11-01", "0 mo"], ["2025-11-09", "11 mo"], [null, ""], ["not-a-date", ""], ["2027-01-01", ""],
  ])("age of %s is %j", (dob, expected) => expect(ageText(dob, today)).toBe(expected));

  const sampleOf = (status: OrderSample["status"]) => ({ status }) as OrderSample;
  it("summarises sample progress", () => {
    expect(sampleSummary([])).toBe("No sample needed");
    expect(sampleSummary([sampleOf("PENDING"), sampleOf("COLLECTED")])).toBe("1 of 2 collected");
    expect(sampleSummary([sampleOf("COLLECTED"), sampleOf("COLLECTED")])).toBe("2 collected");
    expect(sampleSummary([sampleOf("RECEIVED"), sampleOf("RECEIVED")])).toBe("2 received");
    expect(sampleSummary([sampleOf("REJECTED"), sampleOf("PENDING")])).toBe("0 of 1 collected");
  });
});

// ---------------------------------------------------------------- API

let admin: TestUser;
let receptionist: TestUser;
let labStaff: TestUser;
let accountant: TestUser;
let patientId = "";
const run = Date.now().toString(36).toUpperCase();
let counter = 0;
const ids: Record<string, string> = {};

const makeTest = async (key: string, sampleType: string | null, price: number, over: Record<string, unknown> = {}) => {
  const code = `O${run}${counter++}`;
  const row = await prisma.clinicService.create({ data: { code, name: `Order ${key} ${code}`, kind: "TEST", sampleType, standardPrice: price, durationMinutes: 15, ...over } });
  ids[key] = row.id;
  return row;
};

const place = (body: Record<string, unknown>, cookie = receptionist.cookie) =>
  call(createOrder, "/api/orders", { method: "POST", body: { patientId, priority: "ROUTINE", ...body }, cookie });
const sample = (id: string, body: unknown, cookie = labStaff.cookie) =>
  call(changeSample, `/api/samples/${id}`, { method: "PATCH", body, cookie, params: { id } });
const cancel = (id: string, reason = "Patient changed their mind", cookie = receptionist.cookie) =>
  call(cancelOrder, `/api/orders/${id}/cancel`, { method: "POST", body: { reason }, cookie, params: { id } });
const scan = (code: string, cookie = labStaff.cookie) => call(scanSample, "/api/samples/scan", { method: "POST", body: { code }, cookie });
const bySample = (order: { samples: { sampleType: string; id: string; sampleCode: string; status: string }[] }, type: string) => order.samples.find((entry) => entry.sampleType === type && entry.status !== "REJECTED")!;

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  labStaff = await createSession("lab_staff");
  accountant = await createSession("accountant");
  patientId = (await prisma.patient.create({ data: { ...patientInput(), patientCode: `PID-ORD-${run}`, sex: "FEMALE" } })).id;
  await makeTest("cbc", "Blood", 500);
  await makeTest("fbs", "Blood", 150);
  await makeTest("ure", "Urine", 200);
  await makeTest("ecg", "None", 400);
  await makeTest("off", "Blood", 100, { isActive: false });
  const panelRow = await prisma.clinicService.create({ data: { code: `P${run}`, name: `Panel ${run}`, kind: "PANEL", standardPrice: 600, durationMinutes: 15 } });
  ids.panel = panelRow.id;
  await prisma.testPanelItem.createMany({ data: [{ panelId: panelRow.id, testId: ids.cbc }, { panelId: panelRow.id, testId: ids.ure }] });
  ids.service = (await prisma.clinicService.create({ data: { code: `H${run}`, name: `Home ${run}`, kind: "SERVICE", standardPrice: 100, durationMinutes: 30 } })).id;
});

describe("placing an order", () => {
  it("creates the order, one sample per sample type, and a linked invoice", async () => {
    const made = await place({ serviceIds: [ids.cbc, ids.fbs, ids.ure] });
    expect(made.status).toBe(201);
    const order = made.json.order;
    expect(order.orderCode).toMatch(/^ORD-\d{6}$/);
    expect(order.status).toBe("ORDERED");
    expect(order.items).toHaveLength(3);
    expect(order.samples).toHaveLength(2);
    expect(order.samples.every((entry: { sampleCode: string; status: string }) => /^SMP-\d{6}$/.test(entry.sampleCode) && entry.status === "PENDING")).toBe(true);
    // Both blood tests share the one blood sample.
    const blood = bySample(order, "Blood");
    expect(order.items.filter((item: { sampleId: string }) => item.sampleId === blood.id)).toHaveLength(2);
    expect(order.invoice).toMatchObject({ status: "ISSUED", subtotal: "850", total: "850.00", paid: "0.00", due: "850.00" });
    const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: order.invoice.id }, include: { items: true } });
    expect(stored.items).toHaveLength(3);
  });

  it("bills a panel once at its own price and expands it into its tests", async () => {
    const made = await place({ serviceIds: [ids.panel] });
    expect(made.status).toBe(201);
    expect(made.json.order.items.map((item: { panelId: string }) => item.panelId)).toEqual([ids.panel, ids.panel]);
    expect(made.json.order.invoice.total).toBe("600.00");
    expect(made.json.order.samples).toHaveLength(2);
  });

  it("snapshots test names so later catalog edits do not rewrite an order", async () => {
    const made = await place({ serviceIds: [ids.fbs] });
    await prisma.clinicService.update({ where: { id: ids.fbs }, data: { name: `Renamed ${run}` } });
    const loaded = await call(getOrder, `/api/orders/${made.json.order.id}`, { cookie: admin.cookie, params: { id: made.json.order.id } });
    expect(loaded.json.order.items[0].testName).toMatch(/^Order fbs/);
  });

  it("is ready for the lab at once when nothing needs collecting", async () => {
    const made = await place({ serviceIds: [ids.ecg] });
    expect(made.json.order.samples).toHaveLength(0);
    expect(made.json.order.status).toBe("RECEIVED");
  });

  it("bills a plain service alongside a test and applies a discount", async () => {
    const made = await place({ serviceIds: [ids.cbc, ids.service], discount: 50, priority: "URGENT", referredBy: "Dr Karim", clinicalNotes: "Fever for 3 days" });
    expect(made.status).toBe(201);
    expect(made.json.order).toMatchObject({ priority: "URGENT", referredBy: "Dr Karim", clinicalNotes: "Fever for 3 days" });
    expect(made.json.order.invoice).toMatchObject({ subtotal: "600", discount: "50", total: "550.00" });
  });

  // Bodies are built lazily: the ids only exist once beforeAll has created the catalog.
  it.each<[string, () => Record<string, unknown>, number]>([
    ["a discount above the total", () => ({ serviceIds: [ids.fbs], discount: 99999 }), 400],
    ["no tests", () => ({ serviceIds: [] }), 400],
    ["a test twice", () => ({ serviceIds: [ids.cbc, ids.cbc] }), 400],
    ["a test and a panel that contains it", () => ({ serviceIds: [ids.cbc, ids.panel] }), 409],
    ["a disabled test", () => ({ serviceIds: [ids.off] }), 409],
    ["an unknown test", () => ({ serviceIds: ["nope"] }), 409],
    ["an unknown patient", () => ({ serviceIds: [ids.cbc], patientId: "nobody" }), 404],
  ])("refuses %s", async (_label, body, status) => {
    const before = await prisma.testOrder.count();
    const result = await place(body());
    expect(result.status).toBe(status);
    expect(result.json.error).toBeTruthy();
    expect(await prisma.testOrder.count()).toBe(before); // nothing half-created
  });

  it("refuses an inactive patient and creates no invoice", async () => {
    const inactive = await prisma.patient.create({ data: { ...patientInput(), patientCode: `PID-OI-${run}`, isActive: false } });
    const invoices = await prisma.invoice.count();
    const result = await place({ serviceIds: [ids.cbc], patientId: inactive.id });
    expect(result.status).toBe(409);
    expect(await prisma.invoice.count()).toBe(invoices);
  });

  it("numbers orders and samples without repeats", async () => {
    const [a, b] = await Promise.all([place({ serviceIds: [ids.ure] }), place({ serviceIds: [ids.ure] })]);
    expect(a.json.order.orderCode).not.toBe(b.json.order.orderCode);
    expect(a.json.order.samples[0].sampleCode).not.toBe(b.json.order.samples[0].sampleCode);
  });
});

describe("handling samples", () => {
  it("moves the order through collected and received only when every sample has", async () => {
    const order = (await place({ serviceIds: [ids.cbc, ids.ure] })).json.order;
    const blood = bySample(order, "Blood");
    const urine = bySample(order, "Urine");

    const first = await sample(blood.id, { action: "collect" });
    expect(first.status).toBe(200);
    expect(first.json.order.status).toBe("ORDERED"); // urine still pending
    const second = await sample(urine.id, { action: "collect" });
    expect(second.json.order.status).toBe("SAMPLE_COLLECTED");
    expect(second.json.order.samples.find((entry: { id: string }) => entry.id === blood.id)).toMatchObject({ status: "COLLECTED", collectedBy: expect.any(String) });

    expect((await sample(blood.id, { action: "receive" })).json.order.status).toBe("SAMPLE_COLLECTED");
    const done = await sample(urine.id, { action: "receive" });
    expect(done.json.order.status).toBe("RECEIVED");
    expect(done.json.order.samples.every((entry: { receivedAt: string }) => entry.receivedAt)).toBe(true);
  });

  it("will not receive an uncollected sample or repeat a step", async () => {
    const order = (await place({ serviceIds: [ids.ure] })).json.order;
    const urine = bySample(order, "Urine");
    expect((await sample(urine.id, { action: "receive" })).status).toBe(409);
    expect((await sample(urine.id, { action: "collect" })).status).toBe(200);
    expect((await sample(urine.id, { action: "collect" })).status).toBe(409);
    expect((await sample(urine.id, { action: "receive" })).status).toBe(200);
    expect((await sample(urine.id, { action: "receive" })).status).toBe(409);
  });

  it("receives by barcode, ignoring case and spaces, and reports unknown codes", async () => {
    const order = (await place({ serviceIds: [ids.ure] })).json.order;
    const urine = bySample(order, "Urine");
    await sample(urine.id, { action: "collect" });
    const scanned = await scan(`  ${urine.sampleCode.toLowerCase()} `);
    expect(scanned.status).toBe(200);
    expect(scanned.json.order.status).toBe("RECEIVED");
    expect((await scan(urine.sampleCode)).status).toBe(409);
    expect((await scan("SMP-999999")).status).toBe(404);
    expect((await scan("  ")).status).toBe(400);
  });

  it("rejects a collected sample, asks for a recollection and keeps the tests", async () => {
    const order = (await place({ serviceIds: [ids.cbc, ids.fbs] })).json.order;
    const blood = bySample(order, "Blood");
    await sample(blood.id, { action: "collect" });
    expect((await sample(blood.id, { action: "reject", reason: "" })).status).toBe(400);

    const rejected = await sample(blood.id, { action: "reject", reason: "Haemolysed" });
    expect(rejected.status).toBe(200);
    const next = rejected.json.order;
    expect(next.status).toBe("ORDERED");
    expect(next.samples).toHaveLength(2);
    const old = next.samples.find((entry: { id: string }) => entry.id === blood.id);
    expect(old).toMatchObject({ status: "REJECTED", rejectReason: "Haemolysed" });
    const replacement = next.samples.find((entry: { id: string }) => entry.id !== blood.id);
    expect(replacement).toMatchObject({ status: "PENDING", sampleType: "Blood", replacesId: blood.id });
    expect(next.items.every((item: { sampleId: string }) => item.sampleId === replacement.id)).toBe(true);
    expect((await sample(blood.id, { action: "reject", reason: "Again" })).status).toBe(409);

    await sample(replacement.id, { action: "collect" });
    expect((await sample(replacement.id, { action: "receive" })).json.order.status).toBe("RECEIVED");
  });

  it("cannot reject a sample that was never collected", async () => {
    const order = (await place({ serviceIds: [ids.ure] })).json.order;
    expect((await sample(bySample(order, "Urine").id, { action: "reject", reason: "Too small" })).status).toBe(409);
  });

  it("freezes samples once result entry has begun", async () => {
    const order = (await place({ serviceIds: [ids.ure] })).json.order;
    const urine = bySample(order, "Urine");
    await sample(urine.id, { action: "collect" });
    await sample(urine.id, { action: "receive" });
    await prisma.testOrder.update({ where: { id: order.id }, data: { status: "IN_PROCESS" } });
    expect((await sample(urine.id, { action: "reject", reason: "Late" })).status).toBe(409);
  });
});

describe("cancelling an order", () => {
  it("voids the unpaid invoice and stops further sample handling", async () => {
    const order = (await place({ serviceIds: [ids.ure] })).json.order;
    const result = await cancel(order.id);
    expect(result.status).toBe(200);
    expect(result.json.order).toMatchObject({ status: "CANCELLED", cancelReason: "Patient changed their mind" });
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: order.invoice.id } })).status).toBe("VOID");
    expect((await sample(bySample(order, "Urine").id, { action: "collect" })).status).toBe(409);
    expect((await cancel(order.id)).status).toBe(409);
  });

  it("refuses while a payment is posted, and needs a reason", async () => {
    const order = (await place({ serviceIds: [ids.ure] })).json.order;
    await prisma.payment.create({ // Dated well in the past so it cannot disturb the finance tests, which total today's cash.
      data: { invoiceId: order.invoice.id, amount: 200, method: "CASH", receivedAt: new Date(Date.now() - 10 * 86_400_000) } });
    const refused = await cancel(order.id);
    expect(refused.status).toBe(409);
    expect(refused.json.error).toMatch(/Refund/);
    expect((await call(getOrder, `/api/orders/${order.id}`, { cookie: admin.cookie, params: { id: order.id } })).json.order.status).toBe("ORDERED");
    expect((await cancel(order.id, "x")).status).toBe(400);
  });

  it("is refused once results are being entered", async () => {
    const order = (await place({ serviceIds: [ids.ure] })).json.order;
    await prisma.testOrder.update({ where: { id: order.id }, data: { status: "RESULT_ENTERED" } });
    expect((await cancel(order.id)).status).toBe(409);
  });
});

describe("listing and access", () => {
  it("filters by status and finds an order by sample code or patient", async () => {
    const order = (await place({ serviceIds: [ids.ure] })).json.order;
    const code = bySample(order, "Urine").sampleCode;
    const found = await call(listOrders, `/api/orders?search=${code}&status=ALL`, { cookie: labStaff.cookie });
    expect(found.json.orders.map((entry: { id: string }) => entry.id)).toEqual([order.id]);
    const open = await call(listOrders, "/api/orders?status=ORDERED", { cookie: labStaff.cookie });
    expect(open.json.orders.every((entry: { status: string }) => entry.status === "ORDERED")).toBe(true);
    const byPhone = await call(listOrders, `/api/orders?search=${order.patient.phone}&status=ALL`, { cookie: labStaff.cookie });
    expect(byPhone.json.orders.length).toBeGreaterThan(0);
  });

  it("pages through the list", async () => {
    const first = await call(listOrders, "/api/orders?status=ALL", { cookie: admin.cookie });
    expect(first.status).toBe(200);
    expect(first.json.orders.length).toBeLessThanOrEqual(50);
    if (first.json.nextCursor) {
      const second = await call(listOrders, `/api/orders?status=ALL&cursor=${first.json.nextCursor}`, { cookie: admin.cookie });
      expect(second.json.orders[0].id).not.toBe(first.json.orders[0].id);
    }
  });

  it("separates who can do what", async () => {
    // Lab staff and accountants can look, but only front desk (and admin) can place or cancel orders.
    expect((await call(listOrders, "/api/orders", { cookie: labStaff.cookie })).status).toBe(200);
    expect((await call(listOrders, "/api/orders", { cookie: accountant.cookie })).status).toBe(200);
    expect((await place({ serviceIds: [ids.ure] }, labStaff.cookie)).status).toBe(403);
    expect((await place({ serviceIds: [ids.ure] }, accountant.cookie)).status).toBe(403);
    const order = (await place({ serviceIds: [ids.ure] })).json.order;
    expect((await cancel(order.id, "Duplicate order", labStaff.cookie)).status).toBe(403);
    // The lab handles samples; the accountant does not.
    expect((await sample(bySample(order, "Urine").id, { action: "collect" }, accountant.cookie)).status).toBe(403);
    expect((await sample(bySample(order, "Urine").id, { action: "collect" }, labStaff.cookie)).status).toBe(200);
  });

  it("returns 404 for a missing order and 401/403 without a session", async () => {
    expect((await call(getOrder, "/api/orders/none", { cookie: admin.cookie, params: { id: "none" } })).status).toBe(404);
    expect((await call(listOrders, "/api/orders")).status).toBeGreaterThanOrEqual(401);
  });

  it("records the actor of each lab step in the audit log", async () => {
    const order = (await place({ serviceIds: [ids.ure] })).json.order;
    await sample(bySample(order, "Urine").id, { action: "collect" });
    const events = await prisma.auditEvent.findMany({ where: { entity: "Sample", action: "COLLECT" }, orderBy: { createdAt: "desc" }, take: 1 });
    expect(events[0]?.actorId).toBe(labStaff.id);
  });
});
