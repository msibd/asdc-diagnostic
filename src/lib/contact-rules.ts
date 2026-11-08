/**
 * Rules for people's contact details, shared by every form and API that takes them (patients,
 * appointments, emergency contacts). Pure functions: safe to run in the browser and on the server,
 * so the form and the API always agree. Each returns a message, or null when the value is fine.
 */

export const CONTACT_LIMITS = {
  nameMin: 2,
  nameMax: 120,
  phoneMax: 30,
  emailMax: 254,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BD_MOBILE_PATTERN = /^(?:\+?88)?01[3-9]\d{8}$/;

/** Removes the spaces, dashes, dots and brackets people type between phone digits. */
export function compactPhone(value: string) {
  return value.replace(/[\s\-().]/g, "");
}

export function validatePersonName(value: string, required: boolean, subject = "the patient's"): string | null {
  const name = value.trim();
  if (!name) return required ? `Enter ${subject} name.` : null;
  if (name.length < CONTACT_LIMITS.nameMin) return `Name must be at least ${CONTACT_LIMITS.nameMin} characters.`;
  if (name.length > CONTACT_LIMITS.nameMax) return `Name must be ${CONTACT_LIMITS.nameMax} characters or fewer.`;
  if (!/\p{L}/u.test(name)) return "Name must contain letters.";
  return null;
}

export function validatePhone(value: string, required: boolean): string | null {
  const raw = value.trim();
  if (!raw) return required ? "Enter a phone number." : null;
  if (raw.length > CONTACT_LIMITS.phoneMax) return `Phone number must be ${CONTACT_LIMITS.phoneMax} characters or fewer.`;
  const digits = compactPhone(raw);
  if (!/^\+?\d+$/.test(digits)) return "Use digits only. A + is allowed at the start.";
  // Bangladeshi numbers get the strict mobile check; other countries just need a sane length.
  if (/^(?:\+?880|0)1/.test(digits)) {
    return BD_MOBILE_PATTERN.test(digits) ? null : "Enter a valid mobile number, for example 01712345678.";
  }
  const length = digits.replace("+", "").length;
  return length >= 7 && length <= 15 ? null : "Phone number must be 7 to 15 digits.";
}

export function validateEmail(value: string): string | null {
  const email = value.trim();
  if (!email) return null;
  if (email.length > CONTACT_LIMITS.emailMax) return `Email must be ${CONTACT_LIMITS.emailMax} characters or fewer.`;
  return EMAIL_PATTERN.test(email) ? null : "Enter a valid email address, for example name@example.com.";
}
