import { createHmac } from "node:crypto";

// Bangladeshi mobile numbers in the form the SMS gateway expects: 8801XXXXXXXXX (13 digits).

const BD_MOBILE = /^8801[3-9]\d{8}$/;

/** "01712-345678", "+8801712345678", "8801712345678" -> "8801712345678"; anything else -> null. */
export function normalizeBdMobile(input: string | null | undefined) {
  const digits = (input ?? "").replace(/\D/g, "");
  const full = digits.startsWith("01") && digits.length === 11 ? `88${digits}` : digits;
  return BD_MOBILE.test(full) ? full : null;
}

/** "8801712345678" -> "88017*****678": recognisable in the log, not usable. */
export const maskPhone = (msisdn: string) => `${msisdn.slice(0, 5)}*****${msisdn.slice(-3)}`;

/**
 * A keyed hash of the number, used to count messages per number without storing the number. Keyed
 * (not a plain hash) because the space of phone numbers is small enough to reverse a plain hash.
 */
export function phoneHash(msisdn: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set.");
  return createHmac("sha256", secret).update(`sms-recipient:${msisdn}`).digest("hex");
}
