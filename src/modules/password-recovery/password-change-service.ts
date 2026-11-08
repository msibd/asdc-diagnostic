import { randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hitRateLimit } from "@/lib/rate-limit";
import { sendSystemEmail } from "@/modules/email/email-config-service";
import { passwordChangeOtpEmail, passwordChangedEmail } from "@/modules/email/templates";
import { OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_MS, generateOtp, hashOtp, normalizeEmail, otpMatches } from "./otp";

// A signed-in user changing their own password must first prove they can read their e-mail: a code
// is sent to the address on their account. The code table and the code rules are the same ones the
// "forgot password" flow uses (otp.ts); this file only adds the two steps of the change itself.

export class PasswordChangeError extends Error {
  constructor(message: string, readonly status: 400 | 429 | 503, readonly retryAfter?: number) {
    super(message);
    this.name = "PasswordChangeError";
  }
}

type Person = { id: string; name: string; email: string };

const INVALID_CODE = "The code is wrong or has expired. Request a new one.";

async function enforce(key: string, max: number, windowSeconds: number) {
  const result = await hitRateLimit(key, max, windowSeconds);
  if (result.limited) throw new PasswordChangeError("Too many attempts. Please wait a while and try again.", 429, result.retryAfter);
}

export const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 2)}${"*".repeat(Math.max(1, Math.min(6, local.length - 2)))}@${domain}`;
};

/** Step 1: e-mail a six-digit code to the signed-in user's own address. */
export async function sendPasswordChangeCode(user: Person, ip: string) {
  await enforce(`pwchange:send:user:${user.id}`, 5, 60 * 60);
  await enforce(`pwchange:send:ip:${ip}`, 10, 60 * 60);

  const recent = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id, invalidatedAt: null, consumedAt: null, createdAt: { gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000) } },
    select: { createdAt: true },
  });
  if (recent) {
    const wait = Math.max(1, OTP_RESEND_COOLDOWN_SECONDS - Math.floor((Date.now() - recent.createdAt.getTime()) / 1000));
    throw new PasswordChangeError("A code was sent a moment ago. Check your e-mail, or wait a little before asking for another.", 429, wait);
  }

  const code = generateOtp();
  const otpId = randomUUID();
  // A new code replaces every earlier one, so there is never more than one live code.
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetOtp.updateMany({ where: { userId: user.id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
    await tx.passwordResetOtp.create({
      data: { id: otpId, userId: user.id, email: normalizeEmail(user.email), codeHash: hashOtp(otpId, code), expiresAt: new Date(Date.now() + OTP_TTL_MS), ipAddress: ip.slice(0, 64) },
    });
  });

  const outcome = await sendSystemEmail(
    user.email,
    passwordChangeOtpEmail({ name: user.name, code, expiresInMinutes: OTP_TTL_MS / 60_000 }),
    { action: "PASSWORD_CHANGE_OTP", actorId: user.id },
  );
  if (!outcome.ok) {
    // The code never left the server, so it must not stay usable.
    await prisma.passwordResetOtp.updateMany({ where: { id: otpId }, data: { invalidatedAt: new Date() } });
    const off = "code" in outcome && outcome.code === "DISABLED";
    throw new PasswordChangeError(
      off ? "E-mail is not set up, so a verification code cannot be sent. Ask an administrator to turn on E-mail settings." : "The verification e-mail could not be sent. Try again in a moment.",
      503,
    );
  }
}

/**
 * Step 2: check the current password and the e-mailed code, then change the password. The current
 * password is checked first so a typo does not use up the code. Each code allows five guesses and
 * works once; the other signed-in sessions are signed out.
 */
export async function changePasswordWithCode(
  user: Person,
  input: { currentPassword: string; newPassword: string; code: string },
  headers: Headers,
  ip: string,
) {
  await enforce(`pwchange:do:user:${user.id}`, 10, 10 * 60);
  await enforce(`pwchange:do:ip:${ip}`, 20, 10 * 60);

  const credential = await prisma.account.findFirst({ where: { userId: user.id, providerId: "credential" }, select: { password: true } });
  const context = await auth.$context;
  if (!credential?.password || !(await context.password.verify({ hash: credential.password, password: input.currentPassword }))) {
    throw new PasswordChangeError("Your current password is not correct.", 400);
  }

  const otp = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id, consumedAt: null, invalidatedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, codeHash: true },
  });
  if (!otp) throw new PasswordChangeError(INVALID_CODE, 400);

  // Spend one attempt first (only while attempts remain), then compare.
  const spent = await prisma.$queryRaw<{ attempts: number }[]>`
    UPDATE "PasswordResetOtp" SET attempts = attempts + 1
    WHERE id = ${otp.id} AND "consumedAt" IS NULL AND "invalidatedAt" IS NULL AND "expiresAt" > (NOW() AT TIME ZONE 'UTC') AND attempts < ${OTP_MAX_ATTEMPTS}
    RETURNING attempts`;
  if (!spent.length) throw new PasswordChangeError(INVALID_CODE, 400);
  if (!otpMatches(otp.id, input.code, otp.codeHash)) {
    if (spent[0].attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.passwordResetOtp.updateMany({ where: { id: otp.id }, data: { invalidatedAt: new Date() } });
    }
    throw new PasswordChangeError(INVALID_CODE, 400);
  }
  // Only one caller can flip this row from unused to used.
  const consumed = await prisma.passwordResetOtp.updateMany({ where: { id: otp.id, consumedAt: null, invalidatedAt: null }, data: { consumedAt: new Date() } });
  if (consumed.count !== 1) throw new PasswordChangeError(INVALID_CODE, 400);

  let cookies: string[] = [];
  try {
    // Better Auth signs every session out and starts a fresh one for this browser; its cookie is handed back to the caller.
    const result = await auth.api.changePassword({
      body: { currentPassword: input.currentPassword, newPassword: input.newPassword, revokeOtherSessions: true },
      headers,
      returnHeaders: true,
    });
    cookies = result.headers.getSetCookie();
  } catch (error) {
    throw new PasswordChangeError(error instanceof Error && error.message ? error.message : "The password could not be changed.", 400);
  }

  await prisma.auditEvent.create({ data: { actorId: user.id, action: "PASSWORD_CHANGE", entity: "User", entityId: user.id, ipAddress: ip.slice(0, 64) } });
  // Best effort: the password is already changed, so a mail problem is not an error.
  await sendSystemEmail(user.email, passwordChangedEmail({ name: user.name }), { action: "PASSWORD_CHANGED_NOTICE", actorId: user.id });
  return { cookies };
}
