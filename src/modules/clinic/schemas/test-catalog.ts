import { z } from "zod";

/**
 * Diagnostic fields of a catalog row (ClinicService): what kind of row it is, how the sample is
 * taken and reported, the result parameters of a test, and the tests inside a panel.
 * Shared by the create and update routes. Absent means "leave unchanged".
 */
export const CATALOG_KINDS = ["SERVICE", "TEST", "PANEL"] as const;
export type CatalogKind = (typeof CATALOG_KINDS)[number];
export const REFERENCE_SEXES = ["ANY", "MALE", "FEMALE"] as const;

export const SAMPLE_TYPES = ["Blood", "Serum", "Plasma", "Urine", "Stool", "Swab", "Sputum", "Semen", "Tissue", "Fluid", "None"] as const;

export const TEST_LIMITS = {
  parameters: 60,
  rangesPerParameter: 12,
  panelTests: 100,
  parameterName: 80,
  unit: 30,
  rangeNote: 120,
  preparation: 1000,
  sampleType: 40,
  maxTurnaroundHours: 24 * 30,
} as const;

const optionalNumber = (label: string, min = -1e9, max = 1e9) =>
  z.number({ error: `${label} must be a number.` }).finite(`${label} must be a number.`).min(min, `${label} is too small.`).max(max, `${label} is too large.`).nullish().transform((value) => value ?? null);

export const referenceRangeSchema = z.object({
  sex: z.enum(REFERENCE_SEXES, { error: "Choose Any, Male or Female for the range." }).default("ANY"),
  minAgeYears: optionalNumber("Minimum age", 0, 150),
  maxAgeYears: optionalNumber("Maximum age", 0, 150),
  low: optionalNumber("Low limit"),
  high: optionalNumber("High limit"),
  criticalLow: optionalNumber("Critical low"),
  criticalHigh: optionalNumber("Critical high"),
  note: z.string().trim().max(TEST_LIMITS.rangeNote, `Range text must be ${TEST_LIMITS.rangeNote} characters or fewer.`).nullish().transform((value) => value || null),
}).superRefine((range, ctx) => {
  const issue = (message: string, path: string) => ctx.addIssue({ code: "custom", message, path: [path] });
  if (range.minAgeYears !== null && range.maxAgeYears !== null && range.minAgeYears > range.maxAgeYears) issue("Minimum age cannot be above the maximum age.", "maxAgeYears");
  if (range.low !== null && range.high !== null && range.low > range.high) issue("Low limit cannot be above the high limit.", "high");
  if (range.criticalLow !== null && range.low !== null && range.criticalLow > range.low) issue("Critical low must not be above the low limit.", "criticalLow");
  if (range.criticalHigh !== null && range.high !== null && range.criticalHigh < range.high) issue("Critical high must not be below the high limit.", "criticalHigh");
  if (range.low === null && range.high === null && range.note === null) issue("Give a low or high limit, or a text such as Negative.", "low");
});

export const parameterSchema = z.object({
  name: z.string({ error: "Parameter name is required." }).trim().min(1, "Parameter name is required.").max(TEST_LIMITS.parameterName, `Parameter name must be ${TEST_LIMITS.parameterName} characters or fewer.`),
  unit: z.string().trim().max(TEST_LIMITS.unit, `Unit must be ${TEST_LIMITS.unit} characters or fewer.`).nullish().transform((value) => value || null),
  ranges: z.array(referenceRangeSchema).max(TEST_LIMITS.rangesPerParameter, `Add at most ${TEST_LIMITS.rangesPerParameter} ranges to a parameter.`).default([]),
});

export const testCatalogFields = {
  kind: z.enum(CATALOG_KINDS, { error: "Choose Test, Panel or Service." }).optional(),
  sampleType: z.string().trim().max(TEST_LIMITS.sampleType).nullish().transform((value) => (value === undefined ? undefined : value || null)),
  turnaroundHours: z.number({ error: "Report time must be a whole number of hours." }).int("Report time must be a whole number of hours.").min(1, "Report time must be at least 1 hour.").max(TEST_LIMITS.maxTurnaroundHours, "Report time is too long.").nullish(),
  fastingRequired: z.boolean().optional(),
  preparation: z.string().trim().max(TEST_LIMITS.preparation, `Patient instructions must be ${TEST_LIMITS.preparation} characters or fewer.`).nullish().transform((value) => (value === undefined ? undefined : value || null)),
  parameters: z.array(parameterSchema).max(TEST_LIMITS.parameters, `Add at most ${TEST_LIMITS.parameters} parameters.`).optional(),
  panelTestIds: z.array(z.string().min(1)).max(TEST_LIMITS.panelTests, `A panel can hold at most ${TEST_LIMITS.panelTests} tests.`).optional(),
};

type CatalogFields = { kind?: CatalogKind; parameters?: { name: string }[]; panelTestIds?: string[] };

/** Cross-field rules. `creating` is true for POST, where a panel must come with its tests. */
export function catalogRulesError(value: CatalogFields, creating: boolean): { message: string; path: string[] } | null {
  const names = new Set<string>();
  for (const parameter of value.parameters ?? []) {
    const key = parameter.name.toLowerCase();
    if (names.has(key)) return { message: `Parameter "${parameter.name}" is listed twice.`, path: ["parameters"] };
    names.add(key);
  }
  if (value.panelTestIds && new Set(value.panelTestIds).size !== value.panelTestIds.length) return { message: "A test is listed twice in the panel.", path: ["panelTestIds"] };
  if (value.kind === "PANEL" && creating && (value.panelTestIds?.length ?? 0) < 2) return { message: "A panel needs at least two tests.", path: ["panelTestIds"] };
  if (value.kind && value.kind !== "PANEL" && value.panelTestIds?.length) return { message: "Only a panel can contain tests.", path: ["panelTestIds"] };
  if (value.kind && value.kind !== "TEST" && value.parameters?.length) return { message: "Only a test can have result parameters.", path: ["parameters"] };
  return null;
}
