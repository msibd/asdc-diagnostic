import { prisma } from "@/lib/prisma";
import { parseCsv } from "@/lib/csv";
import { POST as createPatient } from "@/app/api/patients/route";
import { POST as createItem } from "@/app/api/inventory/items/route";
import { POST as createTest } from "@/app/api/services/route";
import { patientInputSchema } from "@/modules/patients/schemas/patient-schema";
import { itemInputSchema } from "@/modules/inventory/inventory-schema";
import { serviceSchema } from "@/modules/clinic/schemas/service-create";
import { catalogRulesError } from "@/modules/clinic/schemas/test-catalog";
import {
  IMPORT_LIMITS, IMPORT_MODULES,
  type ImportModule, type ImportPreview, type ImportResult, type ImportRowCheck, type ImportRowOutcome,
} from "./import-config";

type Values = Record<string, string>;
type Row = { line: number; values: Values };
type Checked = ImportRowCheck & { payload?: unknown };

const blank = (value: string | undefined) => value || null;
const issues = (error: { issues: { message: string }[] }) => [...new Set(error.issues.map((issue) => issue.message))];

/** Turns the uploaded text and the column mapping into rows of field values, or explains what is wrong with the file. */
export function readUpload(module: ImportModule, csv: string, mapping: Record<string, string>): { error: string } | { rows: Row[] } {
  let table: string[][];
  try { table = parseCsv(csv); } catch (error) { return { error: error instanceof Error ? error.message : "The file could not be read." }; }
  const [headerRow, ...data] = table;
  if (!headerRow || headerRow.every((cell) => !cell.trim())) return { error: "The file is empty." };
  const headers = headerRow.map((cell) => cell.trim());
  const named = headers.filter(Boolean).map((header) => header.toLowerCase());
  if (new Set(named).size !== named.length) return { error: "Two columns have the same name. Rename one and try again." };

  const fields = IMPORT_MODULES[module].fields;
  for (const [key, header] of Object.entries(mapping)) {
    if (!fields.some((field) => field.key === key)) return { error: `Unknown field "${key}".` };
    if (header && !headers.includes(header)) return { error: `The column "${header}" is not in the file.` };
  }
  for (const field of fields) if (field.required && !mapping[field.key]) return { error: `Choose the column for ${field.label}.` };

  const rows: Row[] = [];
  data.forEach((cells, index) => {
    if (cells.every((cell) => !cell.trim())) return;
    const values: Values = {};
    for (const field of fields) {
      const header = mapping[field.key];
      values[field.key] = header ? (cells[headers.indexOf(header)] ?? "").trim() : "";
    }
    rows.push({ line: index + 2, values });
  });
  if (!rows.length) return { error: "The file has no data rows." };
  if (rows.length > IMPORT_LIMITS.maxRows) return { error: `The file has ${rows.length} rows. Import at most ${IMPORT_LIMITS.maxRows} at a time.` };
  return { rows };
}

const SEX: Record<string, "MALE" | "FEMALE" | "OTHER"> = { male: "MALE", m: "MALE", female: "FEMALE", f: "FEMALE", other: "OTHER" };
const YES = new Set(["yes", "y", "true", "1"]);
const NO = new Set(["no", "n", "false", "0", ""]);

type Lookups = { suppliers: Map<string, string> };

/** The record the module's own route expects, run through the module's own schema. */
function buildPayload(module: ImportModule, values: Values, lookups: Lookups): { payload: unknown; key: string } | { errors: string[] } {
  if (module === "patients") {
    const sex = values.sex ? SEX[values.sex.toLowerCase()] : null;
    if (values.sex && !sex) return { errors: ["Sex must be male, female or other."] };
    const parsed = patientInputSchema.safeParse({
      name: values.name, phone: values.phone, email: blank(values.email), dateOfBirth: blank(values.dateOfBirth), sex: sex ?? null,
      address: blank(values.address), emergencyContactName: blank(values.emergencyContactName), emergencyContactPhone: blank(values.emergencyContactPhone),
      medicalHistory: blank(values.medicalHistory), allergies: blank(values.allergies), notes: blank(values.notes),
    });
    if (!parsed.success) return { errors: issues(parsed.error) };
    return { payload: parsed.data, key: `${parsed.data.name.toLowerCase()}|${parsed.data.phone}` };
  }

  if (module === "inventory-items") {
    const reorder = values.reorderLevel ? Number(values.reorderLevel) : undefined;
    if (reorder !== undefined && !Number.isFinite(reorder)) return { errors: ["Reorder level must be a number."] };
    const supplierId = values.supplier ? lookups.suppliers.get(values.supplier.toLowerCase()) : null;
    if (values.supplier && !supplierId) return { errors: [`Supplier "${values.supplier}" does not exist. Add it under Suppliers first.`] };
    const parsed = itemInputSchema.safeParse({
      name: values.name, category: values.category || undefined, unit: values.unit || undefined, reorderLevel: reorder, supplierId, notes: blank(values.notes),
    });
    if (!parsed.success) return { errors: issues(parsed.error) };
    return { payload: parsed.data, key: parsed.data.name.toLowerCase() };
  }

  const price = Number(values.price);
  if (values.price === "" || !Number.isFinite(price)) return { errors: ["Price must be a number."] };
  const hours = values.turnaroundHours ? Number(values.turnaroundHours) : null;
  if (hours !== null && !Number.isFinite(hours)) return { errors: ["Report time must be a number of hours."] };
  const fasting = values.fastingRequired.toLowerCase();
  if (!YES.has(fasting) && !NO.has(fasting)) return { errors: ["Fasting required must be yes or no."] };
  const parsed = serviceSchema.safeParse({
    code: values.code, name: values.name, category: values.category, description: blank(values.description), kind: "TEST",
    standardPrice: price, durationMinutes: 30, sampleType: blank(values.sampleType), turnaroundHours: hours,
    fastingRequired: YES.has(fasting), preparation: blank(values.preparation),
  });
  if (!parsed.success) return { errors: issues(parsed.error) };
  const rule = catalogRulesError(parsed.data, true);
  if (rule) return { errors: [rule.message] };
  return { payload: parsed.data, key: `${parsed.data.code.toLowerCase()}` };
}

/** Validates every row against the module's schema, then against the file itself and the database for duplicates. */
async function checkRows(module: ImportModule, rows: Row[]): Promise<Checked[]> {
  const suppliers = module === "inventory-items"
    ? new Map((await prisma.supplier.findMany({ select: { id: true, name: true } })).map((supplier) => [supplier.name.toLowerCase(), supplier.id]))
    : new Map<string, string>();

  const built = rows.map((row) => ({ row, result: buildPayload(module, row.values, { suppliers }) }));

  // What already exists, so a repeat is reported as a duplicate instead of failing later.
  const existing = new Set<string>();
  if (module === "patients") {
    const phones = built.flatMap(({ result }) => ("payload" in result ? [(result.payload as { phone: string }).phone] : []));
    for (const patient of await prisma.patient.findMany({ where: { phone: { in: phones } }, select: { name: true, phone: true } })) existing.add(`${patient.name.toLowerCase()}|${patient.phone}`);
  } else if (module === "inventory-items") {
    for (const item of await prisma.inventoryItem.findMany({ select: { name: true } })) existing.add(item.name.toLowerCase());
  } else {
    for (const service of await prisma.clinicService.findMany({ select: { code: true, name: true } })) { existing.add(service.code.toLowerCase()); existing.add(`name:${service.name.toLowerCase()}`); }
  }

  const seen = new Set<string>();
  return built.map(({ row, result }): Checked => {
    if ("errors" in result) return { ...row, status: "invalid", errors: result.errors };
    const payload = result.payload as { name: string };
    const keys = module === "tests" ? [result.key, `name:${payload.name.toLowerCase()}`] : [result.key];
    if (keys.some((key) => existing.has(key))) return { ...row, status: "duplicate", errors: [`Already exists, so it will be skipped.`] };
    if (keys.some((key) => seen.has(key))) return { ...row, status: "duplicate", errors: ["Repeated earlier in this file, so it will be skipped."] };
    keys.forEach((key) => seen.add(key));
    return { ...row, status: "valid", errors: [], payload: result.payload };
  });
}

const CAP = 200;

export async function previewImport(module: ImportModule, rows: Row[]): Promise<ImportPreview> {
  const checked = await checkRows(module, rows);
  const problems = checked.filter((row) => row.status !== "valid");
  return {
    mode: "preview",
    summary: { total: checked.length, valid: checked.length - problems.length, invalid: checked.filter((row) => row.status === "invalid").length, duplicate: checked.filter((row) => row.status === "duplicate").length },
    problems: problems.slice(0, CAP).map(({ line, values, status, errors }) => ({ line, values, status, errors })),
    truncated: problems.length > CAP,
  };
}

const HANDLERS = { patients: createPatient, "inventory-items": createItem, tests: createTest } as const;

/**
 * Validates again, then creates each valid row through the module's own POST route, with the caller's
 * session, so authorization, validation, duplicate rules, transactions and audit entries are exactly
 * the ones the normal screens use. Each row is its own transaction: a failing row never undoes the others.
 */
export async function commitImport(module: ImportModule, rows: Row[], request: Request): Promise<ImportResult> {
  const checked = await checkRows(module, rows);
  const outcomes: ImportRowOutcome[] = [];
  let imported = 0;
  for (const row of checked) {
    const base = { line: row.line, values: row.values };
    if (row.status === "invalid") { outcomes.push({ ...base, status: "failed", message: row.errors.join(" ") }); continue; }
    if (row.status === "duplicate") { outcomes.push({ ...base, status: "skipped", message: row.errors[0] }); continue; }
    const response = await HANDLERS[module](new Request(request.url, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: request.headers.get("cookie") ?? "", "x-forwarded-for": request.headers.get("x-forwarded-for") ?? "" },
      body: JSON.stringify(row.payload),
    }));
    if (response.status === 201) { imported += 1; continue; }
    const message = ((await response.json().catch(() => ({}))) as { error?: string }).error ?? `Could not be saved (HTTP ${response.status}).`;
    outcomes.push({ ...base, status: response.status === 409 ? "skipped" : "failed", message });
  }
  return {
    mode: "commit",
    summary: { total: checked.length, imported, skipped: outcomes.filter((row) => row.status === "skipped").length, failed: outcomes.filter((row) => row.status === "failed").length },
    problems: outcomes.slice(0, CAP),
    truncated: outcomes.length > CAP,
  };
}
