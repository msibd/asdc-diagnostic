/**
 * Appointment field rules, shared by the browser form and the API so both always agree.
 * Pure functions only: no database, no Node-only imports, safe to bundle for the client.
 * The server stays the authority; the browser runs the same checks for instant feedback.
 */

import { CONTACT_LIMITS, validateEmail, validatePersonName, validatePhone } from "@/lib/contact-rules";

export type AppointmentField =
  | "patientName"
  | "patientPhone"
  | "patientEmail"
  | "service"
  | "dateTime"
  | "notes";

export type AppointmentFieldErrors = Partial<Record<AppointmentField, string>>;

export type AppointmentFieldInput = {
  patientId?: string;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  service?: string;
  /** ISO 8601 string, or "" when the browser could not read the date. */
  dateTime?: string;
  notes?: string;
};

export const APPOINTMENT_LIMITS = {
  nameMin: CONTACT_LIMITS.nameMin,
  nameMax: CONTACT_LIMITS.nameMax,
  phoneMax: CONTACT_LIMITS.phoneMax,
  emailMax: CONTACT_LIMITS.emailMax,
  serviceMax: 120,
  notesMax: 2000,
  /** How far ahead a visit can be booked. */
  maxDaysAhead: 365,
} as const;

/** Name, phone and email rules live in one shared place (also used by the patient forms). */
export { compactPhone, validateEmail, validatePhone } from "@/lib/contact-rules";

export function validatePatientName(value: string, required: boolean): string | null {
  return validatePersonName(value, required);
}

export function validateService(value: string): string | null {
  const service = value.trim();
  if (!service) return "Choose a treatment.";
  return service.length > APPOINTMENT_LIMITS.serviceMax ? "That treatment name is too long." : null;
}

export function validateDateTime(value: string, rejectPast: boolean, now: number): string | null {
  if (!value) return "Choose a date and time.";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return "Choose a valid date and time.";
  if (rejectPast && time < now) return "Choose a time in the future.";
  if (time > now + APPOINTMENT_LIMITS.maxDaysAhead * 86_400_000) {
    return `Appointments can be booked up to ${APPOINTMENT_LIMITS.maxDaysAhead} days ahead.`;
  }
  return null;
}

export function validateNotes(value: string): string | null {
  return value.trim().length > APPOINTMENT_LIMITS.notesMax
    ? `Notes must be ${APPOINTMENT_LIMITS.notesMax} characters or fewer.`
    : null;
}

/** Runs every rule and returns the problems by field. An empty object means valid. */
export function validateAppointmentFields(
  input: AppointmentFieldInput,
  options: { rejectPast: boolean; now?: number },
): AppointmentFieldErrors {
  // A linked patient supplies the name and phone from their record.
  const linked = Boolean(input.patientId?.trim());
  const errors: AppointmentFieldErrors = {};
  const checks: [AppointmentField, string | null][] = [
    ["patientName", validatePatientName(input.patientName ?? "", !linked)],
    ["patientPhone", validatePhone(input.patientPhone ?? "", !linked)],
    ["patientEmail", validateEmail(input.patientEmail ?? "")],
    ["service", validateService(input.service ?? "")],
    ["dateTime", validateDateTime(input.dateTime ?? "", options.rejectPast, options.now ?? Date.now())],
    ["notes", validateNotes(input.notes ?? "")],
  ];
  for (const [field, message] of checks) {
    if (message) errors[field] = message;
  }
  return errors;
}

/** The first message in form order, used as the single `error` string of an API response. */
export function firstFieldError(errors: AppointmentFieldErrors): string | undefined {
  const order: AppointmentField[] = ["patientName", "patientPhone", "patientEmail", "service", "dateTime", "notes"];
  return order.map((field) => errors[field]).find(Boolean);
}
