import { beforeAll, describe, expect, it, vi } from "vitest";
import { GET as listServices, POST as createService } from "@/app/api/services/route";
import { GET as getService, PATCH as updateService } from "@/app/api/services/[id]/route";
import { prisma } from "@/lib/prisma";
import { catalogRulesError, parameterSchema, referenceRangeSchema } from "@/modules/clinic/schemas/test-catalog";
import { call, createSession, type TestUser } from "./helpers";

// Next.js cache invalidation only works inside the running server; here we just ignore it.
vi.mock("@/lib/public-cache", () => ({
  publicCacheTags: { clinic: "public-clinic", gallery: "public-gallery", reviews: "public-reviews" },
  invalidatePublicCache: () => undefined,
}));

let admin: TestUser;
let receptionist: TestUser;
const run = Date.now().toString(36).toUpperCase();
let counter = 0;
const code = (prefix: string) => `${prefix}${run}${counter++}`;

const base = (overrides: Record<string, unknown> = {}) => {
  const id = code("T");
  return { code: id, name: `Name ${id}`, category: "Haematology", description: null, standardPrice: 450, durationMinutes: 15, ...overrides };
};
const hb = { name: "Haemoglobin", unit: "g/dL", ranges: [{ sex: "MALE", low: 13, high: 17, criticalLow: 7 }, { sex: "FEMALE", low: 12, high: 15 }] };
const create = (body: unknown, cookie = admin.cookie) => call(createService, "/api/services", { method: "POST", body, cookie });
const detail = (id: string) => call(getService, `/api/services/${id}`, { cookie: admin.cookie, params: { id } });
const patch = (id: string, body: unknown, cookie = admin.cookie) => call(updateService, `/api/services/${id}`, { method: "PATCH", body, cookie, params: { id } });

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
});

describe("reference range rules (pure)", () => {
  const parse = (range: Record<string, unknown>) => referenceRangeSchema.safeParse(range);

  it("accepts a normal range and fills the blanks with null", () => {
    const result = parse({ sex: "MALE", low: 13, high: 17 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toMatchObject({ sex: "MALE", low: 13, high: 17, criticalLow: null, minAgeYears: null, note: null });
  });

  it("accepts a one-sided limit and a text-only range", () => {
    expect(parse({ high: 200 }).success).toBe(true);
    expect(parse({ note: "Negative" }).success).toBe(true);
  });

  it.each([
    ["low above high", { low: 20, high: 10 }],
    ["critical low above the low limit", { low: 10, high: 20, criticalLow: 12 }],
    ["critical high below the high limit", { low: 10, high: 20, criticalHigh: 15 }],
    ["minimum age above maximum age", { low: 1, high: 2, minAgeYears: 60, maxAgeYears: 18 }],
    ["nothing to compare against", { sex: "ANY" }],
    ["an unknown sex", { sex: "OTHER", low: 1, high: 2 }],
    ["a non-numeric limit", { low: "abc", high: 2 }],
  ])("rejects %s", (_label, range) => {
    expect(parse(range).success).toBe(false);
  });

  it("requires a parameter name", () => {
    expect(parameterSchema.safeParse({ name: "  ", unit: null, ranges: [] }).success).toBe(false);
  });
});

describe("catalog cross-field rules (pure)", () => {
  it("flags duplicate parameter names regardless of case", () => {
    expect(catalogRulesError({ kind: "TEST", parameters: [{ name: "Hb" }, { name: "hb" }] }, true)?.path).toEqual(["parameters"]);
  });
  it("needs two tests for a new panel but not when merely editing", () => {
    expect(catalogRulesError({ kind: "PANEL", panelTestIds: ["a"] }, true)?.path).toEqual(["panelTestIds"]);
    expect(catalogRulesError({ kind: "PANEL" }, false)).toBeNull();
  });
  it("keeps parameters on tests and members on panels only", () => {
    expect(catalogRulesError({ kind: "SERVICE", parameters: [{ name: "x" }] }, true)).not.toBeNull();
    expect(catalogRulesError({ kind: "TEST", panelTestIds: ["a", "b"] }, true)).not.toBeNull();
  });
});

describe("catalog API", () => {
  it("creates a test with parameters and ranges and returns them in order", async () => {
    const wbc = { name: "Total WBC", unit: "x10³/µL", ranges: [{ sex: "ANY", low: 4, high: 11 }] };
    const made = await create(base({ kind: "TEST", sampleType: "Blood", turnaroundHours: 6, fastingRequired: false, parameters: [hb, wbc] }));
    expect(made.status).toBe(201);
    expect(made.json.service).toMatchObject({ kind: "TEST", sampleType: "Blood", turnaroundHours: 6, parameterCount: 2 });

    const loaded = await detail(made.json.service.id);
    expect(loaded.status).toBe(200);
    const names = loaded.json.service.parameters.map((parameter: { name: string }) => parameter.name);
    expect(names).toEqual(["Haemoglobin", "Total WBC"]);
    const ranges = loaded.json.service.parameters[0].ranges;
    expect(ranges).toHaveLength(2);
    expect(ranges.find((range: { sex: string }) => range.sex === "MALE")).toMatchObject({ low: "13", high: "17", criticalLow: "7", criticalHigh: null });
  });

  it("still creates a plain service when no lab fields are sent (existing clients)", async () => {
    const made = await create(base({ category: "General" }));
    expect(made.status).toBe(201);
    expect(made.json.service).toMatchObject({ kind: "SERVICE", sampleType: null, turnaroundHours: null, fastingRequired: false, parameterCount: 0 });
  });

  it("lists with counts and filters by kind", async () => {
    const made = await create(base({ kind: "TEST", parameters: [hb] }));
    const all = await call(listServices, "/api/services?includeInactive=true", { cookie: admin.cookie });
    expect(all.json.services.find((item: { id: string }) => item.id === made.json.service.id)).toMatchObject({ parameterCount: 1 });
    const tests = await call(listServices, "/api/services?kind=TEST", { cookie: admin.cookie });
    expect(tests.json.services.length).toBeGreaterThan(0);
    expect(tests.json.services.every((item: { kind: string }) => item.kind === "TEST")).toBe(true);
  });

  it("enabling or disabling does not wipe a test's parameters", async () => {
    const made = (await create(base({ kind: "TEST", parameters: [hb] }))).json.service;
    // The catalog screen's toggle sends the list row back with only isActive changed: no parameters.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping the fields on purpose
    const { parameters: _parameters, ...row } = made;
    const toggled = await patch(made.id, { ...row, standardPrice: Number(row.standardPrice), feeMax: null, isActive: false });
    expect(toggled.status).toBe(200);
    expect(toggled.json.service.isActive).toBe(false);
    expect(toggled.json.service.parameters).toHaveLength(1);
  });

  it("replaces parameters only when the request carries them", async () => {
    const made = (await create(base({ kind: "TEST", parameters: [hb] }))).json.service;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping the fields on purpose
    const { parameters: _parameters, ...row } = made;
    const next = { ...row, standardPrice: Number(row.standardPrice), feeMax: null, isActive: true, parameters: [{ name: "Platelets", unit: "x10³/µL", ranges: [{ sex: "ANY", low: 150, high: 450 }] }] };
    const updated = await patch(made.id, next);
    expect(updated.status).toBe(200);
    expect(updated.json.service.parameters.map((parameter: { name: string }) => parameter.name)).toEqual(["Platelets"]);
    expect(await prisma.testParameter.count({ where: { testId: made.id } })).toBe(1);
  });

  it("rejects invalid ranges and duplicate parameter names with a clear message", async () => {
    const bad = await create(base({ kind: "TEST", parameters: [{ name: "X", unit: null, ranges: [{ sex: "ANY", low: 9, high: 1 }] }] }));
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/Low limit/);
    const twice = await create(base({ kind: "TEST", parameters: [hb, { ...hb, name: "HAEMOGLOBIN" }] }));
    expect(twice.status).toBe(400);
    expect(twice.json.error).toMatch(/twice/);
  });

  it("builds a panel from tests and lists its members", async () => {
    const one = (await create(base({ kind: "TEST", parameters: [hb] }))).json.service;
    const two = (await create(base({ kind: "TEST", parameters: [hb] }))).json.service;
    const panel = await create(base({ kind: "PANEL", category: "Packages", standardPrice: 700, panelTestIds: [one.id, two.id] }));
    expect(panel.status).toBe(201);
    expect(panel.json.service).toMatchObject({ kind: "PANEL", panelTestCount: 2 });
    const loaded = await detail(panel.json.service.id);
    expect(loaded.json.service.panelMembers.map((member: { id: string }) => member.id).sort()).toEqual([one.id, two.id].sort());
  });

  it("refuses a panel containing something that is not a test, and leaves nothing behind", async () => {
    const test = (await create(base({ kind: "TEST", parameters: [hb] }))).json.service;
    const service = (await create(base())).json.service;
    const body = base({ kind: "PANEL", panelTestIds: [test.id, service.id] });
    const refused = await create(body);
    expect(refused.status).toBe(400);
    expect(refused.json.error).toMatch(/existing test/);
    expect(await prisma.clinicService.count({ where: { code: body.code } })).toBe(0);
  });

  it("will not let a panel contain itself", async () => {
    const one = (await create(base({ kind: "TEST", parameters: [hb] }))).json.service;
    const two = (await create(base({ kind: "TEST", parameters: [hb] }))).json.service;
    const panel = (await create(base({ kind: "PANEL", panelTestIds: [one.id, two.id] }))).json.service;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping the fields on purpose
    const { parameters: _parameters, panelMembers: _members, ...row } = panel;
    const result = await patch(panel.id, { ...row, standardPrice: Number(row.standardPrice), feeMax: null, isActive: true, panelTestIds: [panel.id, one.id] });
    expect(result.status).toBe(400);
  });

  it("reports duplicate codes as a conflict", async () => {
    const body = base({ kind: "TEST" });
    expect((await create(body)).status).toBe(201);
    expect((await create({ ...body, name: "Another name" })).status).toBe(409);
  });

  it("lets a receptionist read the catalog but not change it", async () => {
    const read = await call(listServices, "/api/services", { cookie: receptionist.cookie });
    expect(read.status).toBe(200);
    expect((await create(base({ kind: "TEST" }), receptionist.cookie)).status).toBe(403);
    const made = (await create(base({ kind: "TEST" }))).json.service;
    expect((await detail(made.id)).status).toBe(200);
    expect((await patch(made.id, { ...made, standardPrice: 1, feeMax: null, isActive: true }, receptionist.cookie)).status).toBe(403);
  });

  it("returns 404 for a missing item", async () => {
    expect((await detail("does-not-exist")).status).toBe(404);
  });
});
