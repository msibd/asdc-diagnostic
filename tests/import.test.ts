import { beforeAll, describe, expect, it, vi } from "vitest";
import { POST as importRoute } from "@/app/api/import/[module]/route";
import { prisma } from "@/lib/prisma";
import { call, createSession, patientInput, type TestUser } from "./helpers";

// Cache invalidation needs a running Next.js request; the catalog route calls it after a save.
vi.mock("@/lib/public-cache", () => ({ invalidatePublicCache: () => {}, publicCacheTags: { clinic: "public-clinic", doctors: "public-doctors" } }));

let admin: TestUser;
let receptionist: TestUser;
let lab: TestUser;
const run = Date.now().toString(36).toUpperCase();

const csv = (rows: string[][]) => rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
const send = (module: string, body: Record<string, unknown>, user: TestUser | null = admin) =>
  call(importRoute, `/api/import/${module}`, { method: "POST", body: { fileName: "data.csv", mapping: {}, mode: "preview", ...body }, cookie: user?.cookie, params: { module } });

const patientMapping = { name: "Name", phone: "Phone", sex: "Sex", dateOfBirth: "DOB" };
const patientFile = (rows: string[][]) => csv([["Name", "Phone", "Sex", "DOB"], ...rows]);
const newPhone = () => patientInput().phone;

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
  lab = await createSession("lab_staff");
});

describe("file checks", () => {
  it("refuses a file that is not .csv, empty, or has an unclosed quote", async () => {
    expect((await send("patients", { fileName: "data.xlsx", csv: "a,b", mapping: patientMapping })).status).toBe(400);
    expect((await send("patients", { csv: "", mapping: patientMapping })).status).toBe(400);
    const unclosed = await send("patients", { csv: 'Name,Phone\n"Open,0171', mapping: patientMapping });
    expect(unclosed.status).toBe(400);
    expect(unclosed.json.error).toMatch(/quote/i);
  });

  it("refuses a missing required column, a column not in the file, and too many rows", async () => {
    const file = patientFile([["Ayesha Rahman", newPhone(), "female", "1990-01-02"]]);
    expect((await send("patients", { csv: file, mapping: { name: "Name" } })).json.error).toMatch(/Phone/);
    expect((await send("patients", { csv: file, mapping: { ...patientMapping, phone: "Mobile" } })).json.error).toMatch(/not in the file/);
    const many = csv([["Name", "Phone"], ...Array.from({ length: 501 }, (_, index) => [`Person ${index}`, newPhone()])]);
    expect((await send("patients", { csv: many, mapping: { name: "Name", phone: "Phone" } })).json.error).toMatch(/at most 500/);
    expect((await send("nothing", { csv: file, mapping: patientMapping })).status).toBe(404);
  });
});

describe("permissions", () => {
  it("uses the permission needed to add that record by hand", async () => {
    const file = patientFile([["Test Person", newPhone(), "", ""]]);
    expect((await send("patients", { csv: file, mapping: patientMapping }, receptionist)).status).toBe(200);
    expect((await send("patients", { csv: file, mapping: patientMapping }, lab)).status).toBe(403);
    expect((await send("inventory-items", { csv: "Name\nGauze", mapping: { name: "Name" } }, receptionist)).status).toBe(403);
    expect((await send("tests", { csv: "x", mapping: {} }, receptionist)).status).toBe(403);
    expect((await send("patients", { csv: file, mapping: patientMapping }, null)).status).toBeGreaterThanOrEqual(401);
  });
});

describe("patients", () => {
  it("imports valid rows and records one audit entry", async () => {
    const phones = [newPhone(), newPhone()];
    const file = patientFile([[`Import Valid A ${run}`, phones[0], "female", "1990-05-01"], [`Import Valid B ${run}`, phones[1], "M", ""]]);
    const preview = await send("patients", { csv: file, mapping: patientMapping });
    expect(preview.json.summary).toMatchObject({ total: 2, valid: 2, invalid: 0, duplicate: 0 });

    const result = await send("patients", { csv: file, mapping: patientMapping, mode: "commit" });
    expect(result.status).toBe(200);
    expect(result.json.summary).toMatchObject({ total: 2, imported: 2, skipped: 0, failed: 0 });
    const saved = await prisma.patient.findMany({ where: { phone: { in: phones } }, orderBy: { name: "asc" } });
    expect(saved.map((patient) => [patient.sex, patient.patientCode.startsWith("PID-")])).toEqual([["FEMALE", true], ["MALE", true]]);
    const audit = await prisma.auditEvent.findFirst({ where: { action: "IMPORT", entity: "patients" }, orderBy: { createdAt: "desc" } });
    expect(audit?.details).toMatchObject({ rows: 2, imported: 2, file: "data.csv" });
  });

  it("previews changes nothing", async () => {
    const phone = newPhone();
    const file = patientFile([[`Preview Only ${run}`, phone, "", ""]]);
    await send("patients", { csv: file, mapping: patientMapping });
    expect(await prisma.patient.count({ where: { phone } })).toBe(0);
  });

  it("reports row-level errors and never saves invalid rows, even when commit is called directly", async () => {
    const phone = newPhone();
    const file = patientFile([
      [`Bad Sex ${run}`, phone, "robot", ""],
      ["", newPhone(), "", ""],
      [`Bad Phone ${run}`, "12", "", ""],
      [`Bad Date ${run}`, newPhone(), "", "not-a-date"],
    ]);
    const preview = await send("patients", { csv: file, mapping: patientMapping });
    expect(preview.json.summary).toMatchObject({ total: 4, valid: 0, invalid: 4 });
    expect(preview.json.problems.map((row: { line: number }) => row.line)).toEqual([2, 3, 4, 5]);
    expect(preview.json.problems[0].errors[0]).toMatch(/male, female or other/);

    const result = await send("patients", { csv: file, mapping: patientMapping, mode: "commit" });
    expect(result.json.summary).toMatchObject({ imported: 0, failed: 4 });
    expect(await prisma.patient.count({ where: { phone } })).toBe(0);
  });

  it("skips duplicates of existing patients and repeats inside the file", async () => {
    const phone = newPhone();
    const existing = patientFile([[`Dup Person ${run}`, phone, "", ""]]);
    expect((await send("patients", { csv: existing, mapping: patientMapping, mode: "commit" })).json.summary.imported).toBe(1);

    const again = patientFile([
      [`dup person ${run}`, phone, "", ""],
      [`Fresh Person ${run}`, newPhone(), "", ""],
      [`Same In File ${run}`, "01711000001", "", ""],
      [`Same In File ${run}`, "01711000001", "", ""],
    ]);
    const preview = await send("patients", { csv: again, mapping: patientMapping });
    expect(preview.json.summary).toMatchObject({ total: 4, valid: 2, duplicate: 2 });
    const result = await send("patients", { csv: again, mapping: patientMapping, mode: "commit" });
    expect(result.json.summary).toMatchObject({ imported: 2, skipped: 2, failed: 0 });
    expect(await prisma.patient.count({ where: { phone } })).toBe(1);
  });

  it("completes a partly failed import: good rows saved, bad ones reported, nothing rolled back", async () => {
    const good = newPhone();
    const file = patientFile([
      [`Mixed Good ${run}`, good, "", ""],
      [`Mixed Bad ${run}`, "", "", ""],
      [`Dup Person ${run}`, "", "", ""],
    ]);
    const result = await send("patients", { csv: file, mapping: patientMapping, mode: "commit" });
    expect(result.json.summary).toMatchObject({ total: 3, imported: 1, failed: 2 });
    expect(result.json.problems).toHaveLength(2);
    expect(await prisma.patient.count({ where: { phone: good } })).toBe(1);
  });
});

describe("inventory items", () => {
  const mapping = { name: "Item", category: "Category", unit: "Unit", reorderLevel: "Reorder", supplier: "Supplier" };
  const file = (rows: string[][]) => csv([["Item", "Category", "Unit", "Reorder", "Supplier"], ...rows]);

  it("checks the supplier reference, numbers and duplicates, then imports the good rows", async () => {
    const supplier = await prisma.supplier.create({ data: { name: `Import Supplier ${run}` } });
    const data = file([
      [`Import Reagent ${run}`, "Reagents", "box", "5", `import supplier ${run}`],
      [`Import Missing Supplier ${run}`, "Reagents", "box", "5", "No Such Supplier"],
      [`Import Bad Number ${run}`, "Reagents", "box", "lots", ""],
      [`Import Reagent ${run}`, "Reagents", "box", "5", ""],
    ]);
    const preview = await send("inventory-items", { csv: data, mapping });
    expect(preview.json.summary).toMatchObject({ total: 4, valid: 1, invalid: 2, duplicate: 1 });
    expect(preview.json.problems.find((row: { line: number }) => row.line === 3).errors[0]).toMatch(/Supplier "No Such Supplier" does not exist/);

    const result = await send("inventory-items", { csv: data, mapping, mode: "commit" });
    expect(result.json.summary).toMatchObject({ imported: 1, skipped: 1, failed: 2 });
    const item = await prisma.inventoryItem.findFirst({ where: { name: `Import Reagent ${run}` } });
    expect(item).toMatchObject({ unit: "box", reorderLevel: 5, supplierId: supplier.id });
    expect(item?.sku).toMatch(/^ITM-/);

    // The same file again: the item now exists, so it is skipped rather than failing.
    const second = await send("inventory-items", { csv: file([[`Import Reagent ${run}`, "Reagents", "box", "5", ""]]), mapping, mode: "commit" });
    expect(second.json.summary).toMatchObject({ imported: 0, skipped: 1, failed: 0 });
  });
});

describe("tests", () => {
  const mapping = { code: "Code", name: "Name", category: "Category", price: "Price", sampleType: "Sample", turnaroundHours: "Hours", fastingRequired: "Fasting" };
  const file = (rows: string[][]) => csv([["Code", "Name", "Category", "Price", "Sample", "Hours", "Fasting"], ...rows]);

  it("imports tests with the same rules as the catalog screen, and reports duplicates and bad values", async () => {
    const code = `IMP${run}`.slice(0, 12);
    const data = file([
      [code, `Import Glucose ${run}`, "Biochemistry", "250", "Blood", "6", "yes"],
      [`${code}X`, `Import Bad Price ${run}`, "Biochemistry", "abc", "Blood", "6", "no"],
      [`${code}Y`, `Import Bad Hours ${run}`, "Biochemistry", "100", "Blood", "0", "no"],
      [code, `Import Same Code ${run}`, "Biochemistry", "100", "Blood", "6", "no"],
      [`${code}Z`, `Import Fasting ${run}`, "Biochemistry", "100", "Blood", "6", "maybe"],
    ]);
    const preview = await send("tests", { csv: data, mapping });
    expect(preview.json.summary).toMatchObject({ total: 5, valid: 1, invalid: 3, duplicate: 1 });

    const result = await send("tests", { csv: data, mapping, mode: "commit" });
    expect(result.json.summary).toMatchObject({ imported: 1, skipped: 1, failed: 3 });
    const saved = await prisma.clinicService.findUnique({ where: { code } });
    expect(saved).toMatchObject({ kind: "TEST", category: "Biochemistry", sampleType: "Blood", turnaroundHours: 6, fastingRequired: true });
    expect(Number(saved?.standardPrice)).toBe(250);
  });
});
