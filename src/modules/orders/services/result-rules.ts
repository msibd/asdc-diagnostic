// Pure rules for lab results: which reference range applies to a patient, and how a value compares
// with it. No database or browser code, so the server (which decides and stores the flag) and the
// entry screen (which previews it while typing) run exactly the same logic.
//
// Conventions, so nobody has to guess what a limit means:
//   low / high            the normal limits, inclusive: a value equal to a limit is NORMAL.
//   criticalLow / High    inclusive the other way: a value equal to a critical limit IS critical.
//   a one-sided range     only "high" (e.g. cholesterol <= 200) or only "low" (e.g. HDL >= 40).
//   a text-only range     e.g. "Negative": the value must match it, otherwise it is ABNORMAL.

export type ResultFlag = "NORMAL" | "LOW" | "HIGH" | "CRITICAL_LOW" | "CRITICAL_HIGH" | "ABNORMAL";
export type RangeSex = "ANY" | "MALE" | "FEMALE";

export type RangeRow = {
  sex: RangeSex;
  minAgeYears: number | null;
  maxAgeYears: number | null;
  low: number | null;
  high: number | null;
  criticalLow: number | null;
  criticalHigh: number | null;
  note: string | null;
};

export type PatientFacts = { sex: "MALE" | "FEMALE" | "OTHER" | null; ageYears: number | null };

/** Why no range could be chosen, so the screen can say something more useful than "no range". */
export type NoRangeReason = "NONE_DEFINED" | "SEX_UNKNOWN" | "AGE_UNKNOWN" | "NO_MATCH";

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

/** Age in (fractional) years on a given day, or null when the date of birth is unknown or invalid. */
export function ageYearsAt(dateOfBirth: string | Date | null | undefined, at: Date): number | null {
  if (!dateOfBirth) return null;
  const born = typeof dateOfBirth === "string" ? new Date(`${dateOfBirth.slice(0, 10)}T00:00:00.000Z`) : dateOfBirth;
  if (Number.isNaN(born.getTime())) return null;
  const years = (at.getTime() - born.getTime()) / MS_PER_YEAR;
  return years < 0 ? null : years;
}

const isAgeBound = (range: RangeRow) => range.minAgeYears !== null || range.maxAgeYears !== null;

/**
 * Picks the one range that applies to this patient, or says why none does.
 * A range applies when its sex is ANY or the patient's, and the patient's age is inside its age band
 * (a range with no age band fits every age). When several apply, the most specific wins: a sex-specific
 * range beats ANY, a bounded age band beats an open one, and a narrower band beats a wider one.
 * We never guess: a sex-specific range is NOT used for a patient whose sex is not recorded.
 */
export function pickReferenceRange(ranges: RangeRow[], patient: PatientFacts): { range: RangeRow; reason?: undefined } | { range: null; reason: NoRangeReason } {
  if (!ranges.length) return { range: null, reason: "NONE_DEFINED" };

  const sexFits = (range: RangeRow) => range.sex === "ANY" || (patient.sex !== null && range.sex === patient.sex);
  const ageFits = (range: RangeRow) => {
    if (!isAgeBound(range)) return true;
    if (patient.ageYears === null) return false;
    return (range.minAgeYears === null || patient.ageYears >= range.minAgeYears) && (range.maxAgeYears === null || patient.ageYears <= range.maxAgeYears);
  };

  const fitting = ranges.filter((range) => sexFits(range) && ageFits(range));
  if (!fitting.length) {
    if (ranges.some((range) => range.sex !== "ANY") && (patient.sex === null || patient.sex === "OTHER") && !ranges.some((range) => range.sex === "ANY" && ageFits(range))) return { range: null, reason: "SEX_UNKNOWN" };
    if (patient.ageYears === null && ranges.some(isAgeBound)) return { range: null, reason: "AGE_UNKNOWN" };
    return { range: null, reason: "NO_MATCH" };
  }

  const band = (range: RangeRow) => (range.maxAgeYears ?? 200) - (range.minAgeYears ?? 0);
  const specificity = (range: RangeRow) => (range.sex !== "ANY" ? 2 : 0) + (isAgeBound(range) ? 1 : 0);
  const [best] = [...fitting].sort((a, b) => specificity(b) - specificity(a) || band(a) - band(b));
  return { range: best };
}

/** Plain-number text only: "13.2", "-0.5", ".8". No thousands commas, no "<5" style values, no "1e3". */
export function parseNumber(text: string): number | null {
  const value = text.trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

const plain = (n: number) => String(Number(n.toPrecision(12)));
const normalise = (text: string) => text.trim().replace(/\s+/g, " ").toLowerCase();

/** The range as printed on a report, e.g. "13 – 17", "≤ 200", "≥ 40" or "Negative". */
export function formatReference(range: RangeRow | null): string | null {
  if (!range) return null;
  if (range.low !== null && range.high !== null) return `${plain(range.low)} – ${plain(range.high)}`;
  if (range.high !== null) return `≤ ${plain(range.high)}`;
  if (range.low !== null) return `≥ ${plain(range.low)}`;
  return range.note;
}

export type Evaluation = { numericValue: number | null; flag: ResultFlag | null } | { error: string };

/** Does this range need a number? (Any numeric limit does; a note-only range wants matching text.) */
export const isNumericRange = (range: RangeRow | null) =>
  range !== null && (range.low !== null || range.high !== null || range.criticalLow !== null || range.criticalHigh !== null);

/** Compares one typed value with the chosen range. Blank values are the caller's business. */
export function evaluateValue(rawValue: string, range: RangeRow | null, label = "This value"): Evaluation {
  const value = rawValue.trim();
  if (!value) return { error: `${label} is empty.` };
  const numeric = parseNumber(value);

  if (range === null) return { numericValue: numeric, flag: null };

  if (isNumericRange(range)) {
    if (numeric === null) return { error: `${label} must be a number (for example 13.2).` };
    let flag: ResultFlag = "NORMAL";
    if (range.criticalLow !== null && numeric <= range.criticalLow) flag = "CRITICAL_LOW";
    else if (range.criticalHigh !== null && numeric >= range.criticalHigh) flag = "CRITICAL_HIGH";
    else if (range.low !== null && numeric < range.low) flag = "LOW";
    else if (range.high !== null && numeric > range.high) flag = "HIGH";
    return { numericValue: numeric, flag };
  }

  // Text range such as "Negative" (alternatives may be separated by "/", e.g. "Negative / Non-reactive").
  const accepted = (range.note ?? "").split("/").map(normalise).filter(Boolean);
  if (!accepted.length) return { numericValue: numeric, flag: null };
  return { numericValue: numeric, flag: accepted.includes(normalise(value)) ? "NORMAL" : "ABNORMAL" };
}

export const isCritical = (flag: ResultFlag | null | undefined) => flag === "CRITICAL_LOW" || flag === "CRITICAL_HIGH";
export const isOutOfRange = (flag: ResultFlag | null | undefined) => flag !== null && flag !== undefined && flag !== "NORMAL";

export const FLAG_LABEL: Record<ResultFlag, string> = {
  NORMAL: "Normal",
  LOW: "Low",
  HIGH: "High",
  CRITICAL_LOW: "Critical low",
  CRITICAL_HIGH: "Critical high",
  ABNORMAL: "Abnormal",
};

/** What to tell the person when no range could be applied. */
export function noRangeMessage(reason: NoRangeReason): string {
  switch (reason) {
    case "NONE_DEFINED": return "No normal range is set for this parameter.";
    case "SEX_UNKNOWN": return "The patient's sex is not recorded, so no sex-specific range could be used.";
    case "AGE_UNKNOWN": return "The patient's date of birth is not recorded, so no age-specific range could be used.";
    case "NO_MATCH": return "No normal range covers this patient's age and sex.";
  }
}
