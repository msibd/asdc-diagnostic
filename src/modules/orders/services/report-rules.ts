// Pure rules of a released lab report: what is frozen into it, how the patient proves who they are,
// and how the report is described in messages. No database, no secrets, safe for the browser too.

import type { ResultFlag } from "@/modules/orders/services/result-rules";

export type SnapshotParameter = {
  name: string;
  value: string;
  unit: string | null;
  flag: ResultFlag | null;
  reference: string | null;
};

export type SnapshotTest = {
  code: string;
  name: string;
  category: string;
  panel: string | null;
  parameters: SnapshotParameter[];
  /** Written result, for a test that has no parameters. */
  text: string | null;
  note: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
};

/** Everything printed on a report, copied at release. Later edits to the catalog or patient never reach it. */
export type ReportSnapshot = {
  schema: 1;
  lab: { name: string; subtitle: string; address: string | null; phone: string | null; email: string | null };
  patient: { name: string; code: string; sex: "MALE" | "FEMALE" | "OTHER" | null; age: string };
  order: { code: string; orderedAt: string; collectedAt: string | null; priority: "ROUTINE" | "URGENT"; referredBy: string | null };
  tests: SnapshotTest[];
  verifiedBy: string[];
  hasCritical: boolean;
};

// ---------------------------------------------------------------- the patient's PIN

/** The digits of a phone number, however it was typed ("01712-345678", "+880 1712 345678"). */
const digitsOf = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "");

/**
 * The PIN a patient types to open their report: the last four digits of the mobile number we have on
 * file. It is not a strong secret (the link is), only a guard against a forwarded or shoulder-surfed
 * link. A number too short to give a meaningful PIN gives none, and the report cannot be opened online.
 */
export function pinFromPhone(phone: string | null | undefined): string | null {
  const digits = digitsOf(phone);
  return digits.length >= 7 ? digits.slice(-4) : null;
}

/** Does what the patient typed match their PIN? Accepts spaces and dashes; nothing else. */
export function pinMatches(phone: string | null | undefined, typed: string | null | undefined): boolean {
  const expected = pinFromPhone(phone);
  if (!expected) return false;
  const given = (typed ?? "").replace(/[\s-]/g, "");
  if (given.length !== expected.length || !/^\d+$/.test(given)) return false;
  let difference = 0;
  for (let i = 0; i < expected.length; i += 1) difference |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return difference === 0;
}

// ---------------------------------------------------------------- the verification code

/** The code printed under the QR: letters and digits without look-alikes (no 0/O, 1/I/L). */
export const VERIFY_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const VERIFY_CODE_LENGTH = 12;

/** "7K2M9QXP4DFA" -> "7K2M-9QXP-4DFA" for printing. */
export const formatVerifyCode = (code: string) => code.replace(/(.{4})(?=.)/g, "$1-");

/** What a person typed, back to the stored form; null when it cannot be a verification code. */
export function normaliseVerifyCode(input: string | null | undefined): string | null {
  const code = (input ?? "").toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== VERIFY_CODE_LENGTH) return null;
  return [...code].every((char) => VERIFY_ALPHABET.includes(char)) ? code : null;
}

// ---------------------------------------------------------------- privacy on the public check page

/** "Rahim Uddin" -> "R**** U****": enough for the patient to recognise, not enough to identify. */
export function maskName(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).map((part) => `${part.charAt(0)}${"*".repeat(Math.min(Math.max(part.length - 1, 1), 6))}`).join(" ");
}

// ---------------------------------------------------------------- printing

const MARK: Record<ResultFlag, string> = { NORMAL: "", LOW: "L", HIGH: "H", CRITICAL_LOW: "LL", CRITICAL_HIGH: "HH", ABNORMAL: "A" };

/** A short, print-safe flag (colour is not reliable on paper): H, L, HH, LL, A or nothing. */
export const flagMark = (flag: ResultFlag | null | undefined) => (flag ? MARK[flag] : "");

// ---------------------------------------------------------------- the SMS

/** First name only, cleaned of control characters and capped, so a odd name cannot break the message. */
const firstName = (name: string) => name.replace(/[\u0000-\u001F\u007F]/g, " ").trim().split(/\s+/)[0]?.slice(0, 20) || "Patient";

export function renderReportSms(values: { lab: string; name: string; orderCode: string; link: string }): string {
  return `${values.lab}: Dear ${firstName(values.name)}, your report ${values.orderCode} is ready. View it here: ${values.link} (PIN: last 4 digits of your mobile number)`;
}
