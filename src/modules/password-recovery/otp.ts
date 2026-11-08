import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

// Pure helpers for the one-time code and the reset token. No database, no e-mail.

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_SECONDS = 60;
/** How long a verified code lets the person choose a new password. */
export const RESET_AUTHORIZATION_TTL_MS = 10 * 60 * 1000;

/** A uniformly random six-digit code from the operating system's secure random source. */
export function generateOtp() {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0");
}

function hmacKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must be set to at least 32 characters.");
  // A separate key for this purpose, derived from the app secret.
  return createHmac("sha256", secret).update("password-reset-otp").digest();
}

/**
 * The value stored instead of the code. A plain hash of a six-digit number can be reversed in
 * milliseconds, so it is an HMAC under a server-side key and bound to this OTP's id: a copy of the
 * database cannot be used to read codes, and one code's hash means nothing for another.
 */
export function hashOtp(otpId: string, code: string) {
  return createHmac("sha256", hmacKey()).update(`${otpId}:${code}`).digest("hex");
}

export function otpMatches(otpId: string, code: string, storedHash: string) {
  const expected = Buffer.from(hashOtp(otpId, code), "hex");
  const actual = Buffer.from(storedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** A random 256-bit reset token (handed to the browser once) and its SHA-256 (the only thing stored). */
export function createResetToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashResetToken(token) };
}

export const hashResetToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const normalizeEmail = (value: string) => value.trim().toLowerCase();
