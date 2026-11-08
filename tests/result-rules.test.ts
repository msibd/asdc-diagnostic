import { describe, expect, it } from "vitest";
import {
  ageYearsAt, evaluateValue, formatReference, isCritical, isNumericRange, isOutOfRange, noRangeMessage, parseNumber, pickReferenceRange,
  type PatientFacts, type RangeRow, type ResultFlag,
} from "@/modules/orders/services/result-rules";
import { deriveOrderStatus, type OrderStatus, type ResultState, type SampleState } from "@/modules/orders/services/order-rules";

const range = (over: Partial<RangeRow> = {}): RangeRow => ({ sex: "ANY", minAgeYears: null, maxAgeYears: null, low: null, high: null, criticalLow: null, criticalHigh: null, note: null, ...over });
const flagOf = (value: string, r: RangeRow | null) => {
  const result = evaluateValue(value, r);
  if ("error" in result) throw new Error(result.error);
  return result.flag;
};

describe("parseNumber", () => {
  it.each([["13.2", 13.2], ["  7 ", 7], ["-0.5", -0.5], [".8", 0.8], ["+4", 4], ["0", 0], ["12.", 12]])("accepts %j", (text, expected) => expect(parseNumber(text)).toBe(expected));
  it.each([["abc"], ["1,200"], ["<5"], [">100"], ["1e3"], [""], ["   "], ["12 g"], ["1.2.3"], ["--1"], ["Infinity"], ["NaN"], ["0x10"]])("rejects %j", (text) => expect(parseNumber(text)).toBeNull());
});

describe("flags for a numeric range (boundaries are inclusive)", () => {
  // Haemoglobin, adult male: normal 13-17, critical at or below 7.
  const hb = range({ low: 13, high: 17, criticalLow: 7 });
  it.each<[string, ResultFlag]>([
    ["15", "NORMAL"], ["13", "NORMAL"], ["17", "NORMAL"], ["12.9", "LOW"], ["17.1", "HIGH"], ["7.1", "LOW"], ["7", "CRITICAL_LOW"], ["6.9", "CRITICAL_LOW"], ["0", "CRITICAL_LOW"],
  ])("Hb %s -> %s", (value, expected) => expect(flagOf(value, hb)).toBe(expected));

  const glucose = range({ low: 70, high: 100, criticalLow: 40, criticalHigh: 500 });
  it.each<[string, ResultFlag]>([["85", "NORMAL"], ["69.9", "LOW"], ["100.1", "HIGH"], ["40", "CRITICAL_LOW"], ["499.9", "HIGH"], ["500", "CRITICAL_HIGH"], ["650", "CRITICAL_HIGH"]])(
    "glucose %s -> %s", (value, expected) => expect(flagOf(value, glucose)).toBe(expected));

  it("handles a high-only range (cholesterol up to 200)", () => {
    const chol = range({ high: 200 });
    expect([flagOf("150", chol), flagOf("200", chol), flagOf("200.1", chol), flagOf("0", chol)]).toEqual(["NORMAL", "NORMAL", "HIGH", "NORMAL"]);
  });

  it("handles a low-only range (HDL at least 40)", () => {
    const hdl = range({ low: 40 });
    expect([flagOf("55", hdl), flagOf("40", hdl), flagOf("39.9", hdl), flagOf("500", hdl)]).toEqual(["NORMAL", "NORMAL", "LOW", "NORMAL"]);
  });

  it("returns the number it read", () => {
    expect(evaluateValue("13.25", hb)).toEqual({ numericValue: 13.25, flag: "NORMAL" });
  });

  it("critical wins over low/high, and an unreachable critical never fires", () => {
    expect(flagOf("5", range({ low: 10, high: 20, criticalLow: 6 }))).toBe("CRITICAL_LOW");
    expect(flagOf("12", range({ low: 10, high: 20, criticalLow: 2, criticalHigh: 90 }))).toBe("NORMAL");
  });

  it.each([["abc"], ["1,200"], ["<5"], [""], ["  "], ["1e3"]])("refuses %j for a numeric parameter", (value) => {
    expect("error" in evaluateValue(value, hb, "Haemoglobin")).toBe(true);
  });

  it("names the parameter in the error", () => {
    const result = evaluateValue("high", hb, "Haemoglobin");
    expect("error" in result && result.error).toMatch(/Haemoglobin must be a number/);
  });
});

describe("flags for a text range", () => {
  const negative = range({ note: "Negative" });
  it.each<[string, ResultFlag]>([["Negative", "NORMAL"], ["  negative ", "NORMAL"], ["NEGATIVE", "NORMAL"], ["Positive", "ABNORMAL"], ["Trace", "ABNORMAL"]])(
    "%j -> %s", (value, expected) => expect(flagOf(value, negative)).toBe(expected));

  it("accepts any of several normal answers", () => {
    const either = range({ note: "Negative / Non-reactive" });
    expect([flagOf("Non-reactive", either), flagOf("negative", either), flagOf("Reactive", either)]).toEqual(["NORMAL", "NORMAL", "ABNORMAL"]);
  });

  it("collapses repeated spaces when comparing", () => {
    expect(flagOf("Not   detected", range({ note: "Not detected" }))).toBe("NORMAL");
  });
});

describe("no range", () => {
  it("gives no flag but still reads the number and keeps the text", () => {
    expect(evaluateValue("42", null)).toEqual({ numericValue: 42, flag: null });
    expect(evaluateValue("Seen", null)).toEqual({ numericValue: null, flag: null });
  });
  it("still refuses an empty value", () => {
    expect("error" in evaluateValue("  ", null)).toBe(true);
  });
});

describe("helpers", () => {
  it("formats a range the way a report prints it", () => {
    expect(formatReference(range({ low: 13, high: 17 }))).toBe("13 – 17");
    expect(formatReference(range({ low: 0.4, high: 4 }))).toBe("0.4 – 4");
    expect(formatReference(range({ high: 200 }))).toBe("≤ 200");
    expect(formatReference(range({ low: 40 }))).toBe("≥ 40");
    expect(formatReference(range({ note: "Negative" }))).toBe("Negative");
    expect(formatReference(range({ low: 1.005, high: 1.03 }))).toBe("1.005 – 1.03");
    expect(formatReference(null)).toBeNull();
  });
  it("tells numeric ranges from text ranges", () => {
    expect(isNumericRange(range({ low: 1 }))).toBe(true);
    expect(isNumericRange(range({ criticalHigh: 9 }))).toBe(true);
    expect(isNumericRange(range({ note: "Negative" }))).toBe(false);
    expect(isNumericRange(null)).toBe(false);
  });
  it("classifies flags", () => {
    expect(isCritical("CRITICAL_LOW") && isCritical("CRITICAL_HIGH")).toBe(true);
    expect(isCritical("HIGH") || isCritical("NORMAL") || isCritical(null)).toBe(false);
    expect(isOutOfRange("LOW") && isOutOfRange("ABNORMAL")).toBe(true);
    expect(isOutOfRange("NORMAL") || isOutOfRange(null) || isOutOfRange(undefined)).toBe(false);
  });
});

describe("ageYearsAt", () => {
  const at = new Date("2026-11-08T12:00:00Z");
  it("computes fractional years", () => {
    expect(ageYearsAt("1990-11-08", at)).toBeCloseTo(36, 1);
    expect(ageYearsAt("2026-05-08", at)).toBeCloseTo(0.5, 1);
    expect(ageYearsAt(new Date("2000-01-01T00:00:00Z"), at)).toBeCloseTo(26.85, 1);
  });
  it("returns null for missing, invalid or future dates", () => {
    expect(ageYearsAt(null, at)).toBeNull();
    expect(ageYearsAt("", at)).toBeNull();
    expect(ageYearsAt("not-a-date", at)).toBeNull();
    expect(ageYearsAt("2030-01-01", at)).toBeNull();
  });
});

describe("pickReferenceRange", () => {
  const male: PatientFacts = { sex: "MALE", ageYears: 40 };
  const female: PatientFacts = { sex: "FEMALE", ageYears: 40 };
  const hb = [range({ sex: "MALE", low: 13, high: 17 }), range({ sex: "FEMALE", low: 12, high: 15 })];

  it("chooses by sex", () => {
    expect(pickReferenceRange(hb, male).range).toMatchObject({ sex: "MALE", low: 13 });
    expect(pickReferenceRange(hb, female).range).toMatchObject({ sex: "FEMALE", low: 12 });
  });

  it("never guesses a sex-specific range for an unknown sex", () => {
    expect(pickReferenceRange(hb, { sex: null, ageYears: 40 })).toEqual({ range: null, reason: "SEX_UNKNOWN" });
    expect(pickReferenceRange(hb, { sex: "OTHER", ageYears: 40 })).toEqual({ range: null, reason: "SEX_UNKNOWN" });
  });

  it("uses a range for everyone when sex is unknown", () => {
    expect(pickReferenceRange([range({ low: 4, high: 11 })], { sex: null, ageYears: null }).range).toMatchObject({ low: 4 });
    expect(pickReferenceRange([range({ low: 4, high: 11 })], { sex: "OTHER", ageYears: 30 }).range).toMatchObject({ low: 4 });
  });

  it("prefers a sex-specific range over one for everyone", () => {
    const ranges = [range({ low: 1, high: 2 }), range({ sex: "FEMALE", low: 3, high: 4 })];
    expect(pickReferenceRange(ranges, female).range).toMatchObject({ low: 3 });
    expect(pickReferenceRange(ranges, male).range).toMatchObject({ low: 1 });
  });

  describe("age bands", () => {
    const bands = [
      range({ minAgeYears: 0, maxAgeYears: 1, low: 10, high: 20 }),
      range({ minAgeYears: 1, maxAgeYears: 12, low: 11, high: 21 }),
      range({ minAgeYears: 12, maxAgeYears: 150, low: 12, high: 22 }),
    ];
    it.each([[0.5, 10], [5, 11], [30, 12], [80, 12]])("age %s -> low %s", (ageYears, low) => {
      expect(pickReferenceRange(bands, { sex: "MALE", ageYears }).range).toMatchObject({ low });
    });
    it("at a shared edge the narrower band wins", () => {
      expect(pickReferenceRange(bands, { sex: "MALE", ageYears: 1 }).range).toMatchObject({ low: 10 });
      expect(pickReferenceRange(bands, { sex: "MALE", ageYears: 12 }).range).toMatchObject({ low: 11 });
    });
    it("says so when the age is unknown or outside every band", () => {
      expect(pickReferenceRange(bands, { sex: "MALE", ageYears: null })).toEqual({ range: null, reason: "AGE_UNKNOWN" });
      expect(pickReferenceRange([range({ minAgeYears: 18, maxAgeYears: 60, low: 1, high: 2 })], { sex: "MALE", ageYears: 70 })).toEqual({ range: null, reason: "NO_MATCH" });
    });
    it("falls back to an all-ages range when the age is unknown", () => {
      expect(pickReferenceRange([...bands, range({ low: 9, high: 99 })], { sex: "MALE", ageYears: null }).range).toMatchObject({ low: 9 });
    });
    it("combines sex and age: the sex-and-age match beats a plain sex match", () => {
      const ranges = [range({ sex: "FEMALE", low: 12, high: 15 }), range({ sex: "FEMALE", minAgeYears: 0, maxAgeYears: 12, low: 11, high: 13 })];
      expect(pickReferenceRange(ranges, { sex: "FEMALE", ageYears: 8 }).range).toMatchObject({ low: 11 });
      expect(pickReferenceRange(ranges, { sex: "FEMALE", ageYears: 30 }).range).toMatchObject({ low: 12 });
    });
  });

  it("reports that nothing is defined", () => {
    expect(pickReferenceRange([], male)).toEqual({ range: null, reason: "NONE_DEFINED" });
  });

  it("explains each reason in plain words", () => {
    for (const reason of ["NONE_DEFINED", "SEX_UNKNOWN", "AGE_UNKNOWN", "NO_MATCH"] as const) expect(noRangeMessage(reason).length).toBeGreaterThan(10);
  });
});

describe("order status follows the results (pure)", () => {
  const samples = (...states: SampleState[]) => states.map((status) => ({ status }));
  const items = (...states: ResultState[]) => states.map((resultStatus) => ({ resultStatus }));
  it.each<[OrderStatus, ResultState[], OrderStatus]>([
    ["RECEIVED", ["PENDING", "PENDING"], "RECEIVED"],
    ["RECEIVED", ["ENTERED", "PENDING"], "IN_PROCESS"],
    ["IN_PROCESS", ["ENTERED", "ENTERED"], "RESULT_ENTERED"],
    ["IN_PROCESS", ["VERIFIED", "ENTERED"], "RESULT_ENTERED"],
    ["IN_PROCESS", ["VERIFIED", "PENDING"], "IN_PROCESS"],
    ["RESULT_ENTERED", ["VERIFIED", "VERIFIED"], "VERIFIED"],
    ["VERIFIED", ["VERIFIED", "ENTERED"], "RESULT_ENTERED"],     // one test reopened
    ["VERIFIED", ["PENDING", "VERIFIED"], "IN_PROCESS"],          // one test sent back
    ["RESULT_ENTERED", ["PENDING", "PENDING"], "RECEIVED"],       // everything sent back
    ["DELIVERED", ["PENDING"], "DELIVERED"],
    ["CANCELLED", ["ENTERED"], "CANCELLED"],
  ])("%s with %j -> %s", (current, states, expected) => expect(deriveOrderStatus(current, samples("RECEIVED"), items(...states))).toBe(expected));

  it("results never move an order that is still collecting samples", () => {
    expect(deriveOrderStatus("ORDERED", samples("PENDING"), items("ENTERED"))).toBe("ORDERED");
    expect(deriveOrderStatus("SAMPLE_COLLECTED", samples("COLLECTED"), items("ENTERED"))).toBe("SAMPLE_COLLECTED");
  });

  it("an order whose last sample just arrived stays RECEIVED until results are entered", () => {
    expect(deriveOrderStatus("SAMPLE_COLLECTED", samples("RECEIVED"), items("PENDING"))).toBe("RECEIVED");
  });
});
