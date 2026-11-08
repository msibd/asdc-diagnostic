import { validateEmail, validatePersonName, validatePhone } from "@/lib/contact-rules";

/**
 * Patient field rules, shared by the registration form and the API so both always agree.
 * Pure functions only (safe for the browser); the server repeats every check.
 */
export type PatientField =
  | "name"
  | "phone"
  | "email"
  | "dateOfBirth"
  | "address"
  | "emergencyContactName"
  | "emergencyContactPhone"
  | "medicalHistory"
  | "allergies"
  | "notes";

export type PatientFieldErrors = Partial<Record<PatientField, string>>;
export type PatientFieldInput = Partial<Record<PatientField, string | null | undefined>>;

export const PATIENT_LIMITS = {
  address: 1000,
  medicalHistory: 5000,
  allergies: 3000,
  notes: 5000,
  earliestBirthYear: 1900,
} as const;

/** Order the form shows fields in; used to pick the first error and the field to focus. */
export const PATIENT_FIELD_ORDER: PatientField[] = [
  "name", "phone", "email", "dateOfBirth", "emergencyContactName", "emergencyContactPhone",
  "address", "medicalHistory", "allergies", "notes",
];

const text = (value: string | null | undefined) => (value ?? "").trim();

export function validateDateOfBirth(value: string | null | undefined, today = new Date()): string | null {
  const date = text(value);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Enter the date as year-month-day.";
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return "That date does not exist.";
  if (Number(date.slice(0, 4)) < PATIENT_LIMITS.earliestBirthYear) return `Year must be ${PATIENT_LIMITS.earliestBirthYear} or later.`;
  if (date > today.toISOString().slice(0, 10)) return "Date of birth cannot be in the future.";
  return null;
}

function validateLongText(value: string | null | undefined, max: number, label: string): string | null {
  return text(value).length > max ? `${label} must be ${max} characters or fewer.` : null;
}

export function validatePatientFields(input: PatientFieldInput, today = new Date()): PatientFieldErrors {
  const errors: PatientFieldErrors = {};
  const checks: [PatientField, string | null][] = [
    ["name", validatePersonName(text(input.name), true)],
    ["phone", validatePhone(text(input.phone), true)],
    ["email", validateEmail(text(input.email))],
    ["dateOfBirth", validateDateOfBirth(input.dateOfBirth, today)],
    ["emergencyContactName", validatePersonName(text(input.emergencyContactName), false, "the contact's")],
    ["emergencyContactPhone", validatePhone(text(input.emergencyContactPhone), false)],
    ["address", validateLongText(input.address, PATIENT_LIMITS.address, "Address")],
    ["medicalHistory", validateLongText(input.medicalHistory, PATIENT_LIMITS.medicalHistory, "Medical history")],
    ["allergies", validateLongText(input.allergies, PATIENT_LIMITS.allergies, "Allergies")],
    ["notes", validateLongText(input.notes, PATIENT_LIMITS.notes, "Notes")],
  ];
  for (const [field, message] of checks) if (message) errors[field] = message;
  // An emergency contact name without a number (or the reverse) is not usable in an emergency.
  if (!errors.emergencyContactName && !errors.emergencyContactPhone) {
    const hasName = Boolean(text(input.emergencyContactName));
    const hasPhone = Boolean(text(input.emergencyContactPhone));
    if (hasName && !hasPhone) errors.emergencyContactPhone = "Add the emergency contact's phone number.";
    if (hasPhone && !hasName) errors.emergencyContactName = "Add the emergency contact's name.";
  }
  return errors;
}

export function firstPatientFieldError(errors: PatientFieldErrors): string | undefined {
  return PATIENT_FIELD_ORDER.map((field) => errors[field]).find(Boolean);
}

