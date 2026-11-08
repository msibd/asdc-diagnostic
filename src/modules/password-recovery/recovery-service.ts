import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { hitRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import { sendSystemEmail } from "@/modules/email/email-config-service";
import { writeEmailAudit } from "@/modules/email/email-audit";
import { passwordChangedEmail, passwordResetOtpEmail } from "@/modules/email/templates";
import {
  OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN_SECONDS, OTP_TTL_MS, RESET_AUTHORIZATION_TTL_MS,
  createResetToken, generateOtp, hashOtp, hashResetToken, normalizeEmail, otpMatches,
} from "./otp";

/** A failure the caller turns into an HTTP response. Messages never say whether an address is registered. */
export class RecoveryError extends Error {
  constructor(message: string, readonly status: 400 | 429, readonly retryAfter?: number) {
    super(message);
    this.name = "RecoveryError";
  }
}

const INVALID_CODE = "The code is invalid or has expired. Request a new one.";
const INVALID_LINK = "This reset session is invalid or has expired. Start again.";

// Limits by network address and by (normalised) e-mail address, counted whether or not the e-mail
// belongs to anyone, so a limit never reveals which addresses exist.
const LIMITS = {
  requestIp: { max: 10, window: 60 * 60 },
  requestEmail: { max: 5, window: 60 * 60 },
  verifyIp: { max: 30, window: 10 * 60 },
  verifyEmail: { max: 10, window: 10 * 60 },
  completeIp: { max: 20, window: 10 * 60 },
} as const;

async function enforce(key: string, limit: { max: number; window: number }) {
  const result = await hitRateLimit(key, limit.max, limit.window);
  if (result.limited) throw new RecoveryError("Too many attempts. Please wait a while and try again.", 429, result.retryAfter);
}

/**
 * Step 1: send a code to a registered, active staff address. Returns false (and sends nothing) when no
 * such account exists, so the screen can say so. The per-address and per-network limits below count
 * every request, registered or not, which keeps this from being used to list accounts quickly.
 */
export async function requestPasswordReset(emailInput: string, ip: string): Promise<boolean> {
  const email = normalizeEmail(emailInput);
  await enforce(`pwreset:req:ip:${ip}`, LIMITS.requestIp);
  await enforce(`pwreset:req:email:${email}`, LIMITS.requestEmail);

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, isActive: true, accounts: { where: { providerId: "credential" }, select: { id: true }, take: 1 } },
  });
  if (!user || !user.isActive || !user.accounts.length) return false;

  // Resend cooldown: a code requested in the last minute is still the one to use.
  const recent = await prisma.passwordResetOtp.findFirst({
    where: { userId: user.id, invalidatedAt: null, consumedAt: null, createdAt: { gt: new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000) } },
    select: { id: true },
  });
  if (recent) return true;

  const code = generateOtp();
  const otpId = randomUUID();
  // A new code replaces every earlier one, in one step, so there is never more than one live code.
  await prisma.$transaction(async (tx) => {
    await tx.passwordResetOtp.updateMany({ where: { userId: user.id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
    await tx.passwordResetOtp.create({
      data: { id: otpId, userId: user.id, email, codeHash: hashOtp(otpId, code), expiresAt: new Date(Date.now() + OTP_TTL_MS), ipAddress: ip.slice(0, 64) },
    });
  });

  // Housekeeping: now and then, remove codes and tokens that expired a day ago.
  if (Math.random() < 0.05) void purgeExpiredRecoveryData().catch(() => undefined);

  const outcome = await sendSystemEmail(
    user.email,
    passwordResetOtpEmail({ name: user.name, code, expiresInMinutes: OTP_TTL_MS / 60_000 }),
    { action: "PASSWORD_RESET_OTP" },
  );
  if (!outcome.ok) {
    // The code never left the server, so it must not stay usable.
    await prisma.passwordResetOtp.updateMany({ where: { id: otpId }, data: { invalidatedAt: new Date() } });
  }
  return true;
}

/**
 * Step 2: check the code. Each live code allows five guesses in total; the counter moves in the
 * database in one atomic step, so parallel guesses cannot exceed it. A correct code is consumed
 * exactly once and exchanged for a short-lived, single-use reset token.
 */
export async function verifyPasswordResetOtp(emailInput: string, code: string, ip: string) {
  const email = normalizeEmail(emailInput);
  await enforce(`pwreset:verify:ip:${ip}`, LIMITS.verifyIp);
  await enforce(`pwreset:verify:email:${email}`, LIMITS.verifyEmail);

  const otp = await prisma.passwordResetOtp.findFirst({
    where: { email, consumedAt: null, invalidatedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, userId: true, codeHash: true },
  });
  if (!otp) throw new RecoveryError(INVALID_CODE, 400);

  // Spend one attempt first (only while attempts remain), then compare.
  const spent = await prisma.$queryRaw<{ attempts: number }[]>`
    UPDATE "PasswordResetOtp" SET attempts = attempts + 1
    WHERE id = ${otp.id} AND "consumedAt" IS NULL AND "invalidatedAt" IS NULL AND "expiresAt" > (NOW() AT TIME ZONE 'UTC') AND attempts < ${OTP_MAX_ATTEMPTS}
    RETURNING attempts`;
  if (!spent.length) throw new RecoveryError(INVALID_CODE, 400);

  if (!otpMatches(otp.id, code, otp.codeHash)) {
    if (spent[0].attempts >= OTP_MAX_ATTEMPTS) {
      await prisma.passwordResetOtp.updateMany({ where: { id: otp.id }, data: { invalidatedAt: new Date() } });
      await writeEmailAudit({ action: "PASSWORD_RESET_LOCKED", status: "INFO", recipient: email, message: "Too many wrong codes; the code was cancelled." });
    }
    throw new RecoveryError(INVALID_CODE, 400);
  }

  const { token, tokenHash } = createResetToken();
  const authorized = await prisma.$transaction(async (tx) => {
    // Only one caller can flip this row from unused to used; a parallel correct guess gets count 0.
    const consumed = await tx.passwordResetOtp.updateMany({ where: { id: otp.id, consumedAt: null, invalidatedAt: null }, data: { consumedAt: new Date() } });
    if (consumed.count !== 1) return false;
    await tx.passwordResetAuthorization.create({
      data: { userId: otp.userId, otpId: otp.id, tokenHash, expiresAt: new Date(Date.now() + RESET_AUTHORIZATION_TTL_MS) },
    });
    return true;
  });
  if (!authorized) throw new RecoveryError(INVALID_CODE, 400);
  return { token, expiresInSeconds: RESET_AUTHORIZATION_TTL_MS / 1000 };
}

/**
 * Step 3: set the new password. Needs the token from step 2, which works once. The password is
 * hashed with the same function the sign-in uses; every session is revoked; leftover codes die.
 */
export async function completePasswordReset(token: string, newPassword: string, ip: string) {
  await enforce(`pwreset:done:ip:${ip}`, LIMITS.completeIp);
  const tokenHash = hashResetToken(token);
  const passwordHash = await hashPassword(newPassword);

  const result = await prisma.$transaction(async (tx) => {
    const used = await tx.passwordResetAuthorization.updateMany({
      where: { tokenHash, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });
    if (used.count !== 1) return null;
    const authorization = await tx.passwordResetAuthorization.findUniqueOrThrow({ where: { tokenHash }, select: { userId: true } });
    const user = await tx.user.findUnique({ where: { id: authorization.userId }, select: { id: true, name: true, email: true, isActive: true } });
    const credential = await tx.account.findFirst({ where: { userId: authorization.userId, providerId: "credential" }, select: { id: true } });
    if (!user?.isActive || !credential) return null;

    await tx.account.update({ where: { id: credential.id }, data: { password: passwordHash } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    const now = new Date();
    await tx.passwordResetOtp.updateMany({ where: { userId: user.id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
    await tx.passwordResetAuthorization.updateMany({ where: { userId: user.id, consumedAt: null }, data: { consumedAt: now } });
    await tx.auditEvent.create({ data: { actorId: user.id, action: "PASSWORD_RESET", entity: "User", entityId: user.id, ipAddress: ip.slice(0, 64) } });
    return user;
  });
  if (!result) throw new RecoveryError(INVALID_LINK, 400);

  // Best effort: the password is already changed, so a mail problem is only logged.
  await sendSystemEmail(result.email, passwordChangedEmail({ name: result.name }), { action: "PASSWORD_CHANGED_NOTICE" });
}

/** Removes codes and tokens that can no longer be used (called from time to time; harmless to repeat). */
export async function purgeExpiredRecoveryData() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [otps, authorizations] = await Promise.all([
    prisma.passwordResetOtp.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
    prisma.passwordResetAuthorization.deleteMany({ where: { expiresAt: { lt: cutoff } } }),
  ]);
  return { otps: otps.count, authorizations: authorizations.count };
}
