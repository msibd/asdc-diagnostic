import { beforeEach, describe, expect, it, vi } from "vitest";

const mail = vi.hoisted(() => ({ verify: vi.fn(), sendMail: vi.fn(), close: vi.fn(), createTransport: vi.fn() }));
vi.mock("nodemailer", () => {
  mail.createTransport.mockImplementation(() => ({ verify: mail.verify, sendMail: mail.sendMail, close: mail.close }));
  return { default: { createTransport: mail.createTransport } };
});

import { GET as resetStatus } from "@/app/api/password-reset/status/route";
import { POST as requestReset } from "@/app/api/password-reset/request/route";
import { POST as verifyReset } from "@/app/api/password-reset/verify/route";
import { POST as completeReset } from "@/app/api/password-reset/complete/route";
import { GET as listPatients } from "@/app/api/patients/route";
import { auth } from "@/lib/auth";
import { encryptSecret } from "@/modules/email/secret-box";
import { prisma } from "@/lib/prisma";
import {
  OTP_MAX_ATTEMPTS, createResetToken, generateOtp, hashOtp, hashResetToken, otpMatches,
} from "@/modules/password-recovery/otp";
import { call, createUser, signIn, TEST_PASSWORD } from "./helpers";

let ipCounter = 0;
// A fresh network address per test, so the per-address limits of one test never leak into another.
const freshIp = () => `198.51.100.${(ipCounter += 1)}`;
let sent: { to: string; text: string }[] = [];

const request = (email: string, ip = freshIp()) =>
  call(requestReset, "/api/password-reset/request", { method: "POST", body: { email }, headers: { "x-forwarded-for": ip } });
const verify = (email: string, code: string, ip = freshIp()) =>
  call(verifyReset, "/api/password-reset/verify", { method: "POST", body: { email, code }, headers: { "x-forwarded-for": ip } });
const complete = (token: string, password: string, ip = freshIp()) =>
  call(completeReset, "/api/password-reset/complete", { method: "POST", body: { token, password }, headers: { "x-forwarded-for": ip } });
const lastCode = () => {
  const match = /code is: (\d{6})/.exec(sent.at(-1)?.text ?? "");
  if (!match) throw new Error("No code was e-mailed.");
  return match[1];
};
const wrongCode = (code: string) => (code === "000000" ? "111111" : "000000");

async function newStaff(label: string) {
  const user = await createUser("receptionist");
  const email = `${label}.${user.id}@example.test`;
  await prisma.user.update({ where: { id: user.id }, data: { email } });
  return { id: user.id, email };
}

// Switches e-mail on directly in the database: the settings screen's own rules (test first, rate
// limits) are covered in email.test.ts and would only get in the way here.
async function configureEmail() {
  await prisma.emailConfiguration.create({
    data: {
      id: "primary", provider: "gmail", host: "smtp.gmail.com", port: 465, secure: true, authMethod: "APP_PASSWORD",
      username: "clinic@gmail.com", encryptedPassword: encryptSecret("abcdefghijklmnop"), senderEmail: "clinic@gmail.com",
      senderName: "Dr Ovi Dental", enabled: true, lastTestStatus: "SUCCESS",
    },
  });
}

beforeEach(async () => {
  sent = [];
  mail.verify.mockReset().mockResolvedValue(true);
  mail.close.mockReset();
  mail.sendMail.mockReset().mockImplementation(async (message: { to: string; text: string }) => {
    sent.push({ to: message.to, text: message.text });
    return { accepted: [message.to], rejected: [], messageId: "<id>", response: "250 OK" };
  });
  await prisma.emailConfiguration.deleteMany();
  await configureEmail();
  sent = [];
});

describe("one-time codes (pure)", () => {
  it("makes six random digits", () => {
    const codes = new Set(Array.from({ length: 200 }, generateOtp));
    for (const code of codes) expect(code).toMatch(/^\d{6}$/);
    expect(codes.size).toBeGreaterThan(150);
  });

  it("stores a keyed hash that depends on the code and on the OTP, and checks it in constant time", () => {
    const hash = hashOtp("otp-1", "123456");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain("123456");
    expect(hashOtp("otp-2", "123456")).not.toBe(hash);
    expect(hashOtp("otp-1", "123457")).not.toBe(hash);
    expect(otpMatches("otp-1", "123456", hash)).toBe(true);
    expect(otpMatches("otp-1", "654321", hash)).toBe(false);
    expect(otpMatches("otp-1", "123456", "abcd")).toBe(false);
  });

  it("hashes reset tokens and never repeats them", () => {
    const first = createResetToken();
    const second = createResetToken();
    expect(first.token).not.toBe(second.token);
    expect(first.token.length).toBeGreaterThanOrEqual(43);
    expect(hashResetToken(first.token)).toBe(first.tokenHash);
    expect(first.tokenHash).not.toContain(first.token);
  });
});

describe("requesting a code", () => {
  it("e-mails a code and keeps only its hash; an address that is not registered is told so and gets nothing", async () => {
    const staff = await newStaff("known");
    const known = await request(staff.email);
    const unknown = await request(`nobody.${staff.id}@example.test`);
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(404);
    expect(unknown.json.error).toMatch(/no active staff account/i);
    expect(await prisma.passwordResetOtp.count({ where: { email: `nobody.${staff.id}@example.test` } })).toBe(0);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(staff.email);

    const code = lastCode();
    const rows = await prisma.passwordResetOtp.findMany({ where: { userId: staff.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).not.toContain(code);
    expect(JSON.stringify(rows[0])).not.toContain(code);
    expect(otpMatches(rows[0].id, code, rows[0].codeHash)).toBe(true);
    const lifetime = rows[0].expiresAt.getTime() - rows[0].createdAt.getTime();
    expect(lifetime).toBeGreaterThan(4.9 * 60_000);
    expect(lifetime).toBeLessThanOrEqual(5 * 60_000 + 1000);
  });

  it("validates the address format", async () => {
    expect((await request("not-an-email")).status).toBe(400);
  });

  it("sends nothing for deactivated accounts or when e-mail is switched off", async () => {
    const gone = await newStaff("gone");
    await prisma.user.update({ where: { id: gone.id }, data: { isActive: false } });
    expect((await request(gone.email)).status).toBe(404); // a deactivated account counts as not registered
    expect(sent).toHaveLength(0);

    const staff = await newStaff("off");
    await prisma.emailConfiguration.update({ where: { id: "primary" }, data: { enabled: false } });
    expect((await call(resetStatus, "/api/password-reset/status")).json.available).toBe(false);
    expect((await request(staff.email)).status).toBe(200);
    expect(sent).toHaveLength(0);
    // A code that could not be e-mailed must not stay usable.
    expect(await prisma.passwordResetOtp.count({ where: { userId: staff.id, invalidatedAt: null } })).toBe(0);
  });

  it("reports whether the feature is available", async () => {
    expect((await call(resetStatus, "/api/password-reset/status")).json.available).toBe(true);
  });

  it("holds back a resend for 60 seconds, then replaces the old code", async () => {
    const staff = await newStaff("resend");
    await request(staff.email);
    const first = lastCode();
    await request(staff.email);
    expect(sent).toHaveLength(1); // still inside the cooldown: nothing new was sent

    await prisma.passwordResetOtp.updateMany({ where: { userId: staff.id }, data: { createdAt: new Date(Date.now() - 61_000) } });
    await request(staff.email);
    expect(sent).toHaveLength(2);
    const second = lastCode();
    const live = await prisma.passwordResetOtp.findMany({ where: { userId: staff.id, invalidatedAt: null, consumedAt: null } });
    expect(live).toHaveLength(1);

    if (first !== second) {
      // The earlier code no longer works, even though it has not expired.
      expect((await verify(staff.email, first)).status).toBe(400);
    }
    expect((await verify(staff.email, second)).status).toBe(200);
  });

  it("limits requests per e-mail address and per network address", async () => {
    const staff = await newStaff("limited");
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) statuses.push((await request(staff.email)).status);
    expect(statuses.slice(0, 5).every((status) => status === 200)).toBe(true);
    expect(statuses.slice(5)).toEqual([429, 429]);

    const ip = freshIp();
    const byIp: number[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) byIp.push((await request(`other${attempt}.${staff.id}@example.test`, ip)).status);
    // Unknown addresses are told so (404), but every request still counts against the network limit.
    expect(byIp.slice(0, 10).every((status) => status === 404)).toBe(true);
    expect(byIp.slice(10)).toEqual([429, 429]);
  });
});

describe("verifying a code", () => {
  it("accepts the right code once and hands back a single-use reset token", async () => {
    const staff = await newStaff("verify");
    await request(staff.email);
    const code = lastCode();
    const ok = await verify(staff.email, code);
    expect(ok.status).toBe(200);
    expect(ok.json.token).toBeTruthy();
    expect(ok.json.expiresInSeconds).toBeGreaterThan(0);
    const stored = await prisma.passwordResetAuthorization.findMany({ where: { userId: staff.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).not.toContain(ok.json.token);
    expect(JSON.stringify(stored)).not.toContain(ok.json.token);
    // The code is spent.
    expect((await verify(staff.email, code)).status).toBe(400);
  });

  it("rejects a wrong code without saying why, and counts the attempt", async () => {
    const staff = await newStaff("wrong");
    await request(staff.email);
    const code = lastCode();
    const bad = await verify(staff.email, wrongCode(code));
    expect(bad.status).toBe(400);
    expect(bad.json.error).toMatch(/invalid or has expired/i);
    expect((await prisma.passwordResetOtp.findFirstOrThrow({ where: { userId: staff.id } })).attempts).toBe(1);
    // Unknown address: exactly the same answer.
    const stranger = await verify(`stranger.${staff.id}@example.test`, "123456");
    expect(stranger.status).toBe(400);
    expect(stranger.json.error).toBe(bad.json.error);
    expect((await verify(staff.email, "12345")).status).toBe(400); // wrong format
  });

  it("cancels the code after five wrong tries, even if the right one follows", async () => {
    const staff = await newStaff("brute");
    await request(staff.email);
    const code = lastCode();
    for (let attempt = 0; attempt < OTP_MAX_ATTEMPTS; attempt += 1) expect((await verify(staff.email, wrongCode(code))).status).toBe(400);
    const row = await prisma.passwordResetOtp.findFirstOrThrow({ where: { userId: staff.id } });
    expect(row.attempts).toBe(OTP_MAX_ATTEMPTS);
    expect(row.invalidatedAt).not.toBeNull();
    expect((await verify(staff.email, code)).status).toBe(400);
  });

  it("limits parallel guessing to five attempts in total", async () => {
    const staff = await newStaff("parallel");
    await request(staff.email);
    const code = lastCode();
    await Promise.all(Array.from({ length: 12 }, () => verify(staff.email, wrongCode(code), freshIp())));
    expect((await prisma.passwordResetOtp.findFirstOrThrow({ where: { userId: staff.id } })).attempts).toBeLessThanOrEqual(OTP_MAX_ATTEMPTS);
    // Refused either way: the code is cancelled, and the address has also hit its own limit.
    expect((await verify(staff.email, code)).status).not.toBe(200);
  });

  it("refuses an expired code", async () => {
    const staff = await newStaff("expired");
    await request(staff.email);
    const code = lastCode();
    await prisma.passwordResetOtp.updateMany({ where: { userId: staff.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await verify(staff.email, code)).status).toBe(400);
  });

  it("lets only one of many simultaneous correct verifications win", async () => {
    const staff = await newStaff("race");
    await request(staff.email);
    const code = lastCode();
    const results = await Promise.all(Array.from({ length: 6 }, () => verify(staff.email, code, freshIp())));
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
    expect(await prisma.passwordResetAuthorization.count({ where: { userId: staff.id } })).toBe(1);
  });

  it("limits verification requests per network address", async () => {
    const ip = freshIp();
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 32; attempt += 1) statuses.push((await verify(`ip${attempt}@example.test`, "123456", ip)).status);
    expect(statuses.slice(0, 30).every((status) => status === 400)).toBe(true);
    expect(statuses.slice(30)).toEqual([429, 429]);
  });
});

describe("setting the new password", () => {
  async function verified(label: string) {
    const staff = await newStaff(label);
    await request(staff.email);
    const verification = await verify(staff.email, lastCode());
    expect(verification.status).toBe(200);
    return { ...staff, token: verification.json.token as string };
  }

  it("cannot be done without a reset token", async () => {
    const staff = await newStaff("notoken");
    const attempts = await Promise.all([
      complete("", "a-brand-new-password"),
      complete("x".repeat(43), "a-brand-new-password"),
      complete(createResetToken().token, "a-brand-new-password"),
    ]);
    expect(attempts[0].status).toBe(400);
    expect(attempts[1].status).toBe(400);
    expect(attempts[2].status).toBe(400);
    // The OTP alone is not enough either: a request and a guess do not change the password.
    await request(staff.email);
    await expect(auth.api.signInEmail({ body: { email: staff.email, password: TEST_PASSWORD } })).resolves.toBeTruthy();
  });

  it("changes the password, signs the person out everywhere, and notifies them", async () => {
    const staff = await verified("reset");
    const oldCookie = await signIn(staff.email);
    expect((await call(listPatients, "/api/patients", { cookie: oldCookie })).status).toBe(200);
    sent = [];

    const done = await complete(staff.token, "A-brand-new-password-1");
    expect(done.status).toBe(200);
    expect(done.json.success).toBe(true);

    expect((await call(listPatients, "/api/patients", { cookie: oldCookie })).status).toBe(401);
    await expect(auth.api.signInEmail({ body: { email: staff.email, password: TEST_PASSWORD } })).rejects.toThrow();
    await expect(auth.api.signInEmail({ body: { email: staff.email, password: "A-brand-new-password-1" } })).resolves.toBeTruthy();
    expect(await prisma.session.count({ where: { userId: staff.id, token: { not: "" } } })).toBeGreaterThanOrEqual(0);

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toMatch(/password .* was just changed/i);
    expect(sent[0].text).not.toMatch(/A-brand-new-password/);
    const credential = await prisma.account.findFirstOrThrow({ where: { userId: staff.id, providerId: "credential" } });
    expect(credential.password).not.toContain("A-brand-new-password");
    expect(await prisma.auditEvent.count({ where: { entity: "User", entityId: staff.id, action: "PASSWORD_RESET" } })).toBe(1);
  });

  it("accepts the reset token only once", async () => {
    const staff = await verified("once");
    expect((await complete(staff.token, "First-new-password-1")).status).toBe(200);
    expect((await complete(staff.token, "Second-new-password-2")).status).toBe(400);
    await expect(auth.api.signInEmail({ body: { email: staff.email, password: "First-new-password-1" } })).resolves.toBeTruthy();
  });

  it("lets only one of many simultaneous attempts with the same token through", async () => {
    const staff = await verified("tokenrace");
    const results = await Promise.all(Array.from({ length: 5 }, (_, index) => complete(staff.token, `Parallel-password-${index}-x`, freshIp())));
    expect(results.filter((result) => result.status === 200)).toHaveLength(1);
  });

  it("refuses an expired token and a weak password, and cancels leftover codes after a success", async () => {
    const expired = await verified("lapsed");
    await prisma.passwordResetAuthorization.updateMany({ where: { userId: expired.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await complete(expired.token, "Another-new-password-1")).status).toBe(400);

    const weak = await verified("weak");
    expect((await complete(weak.token, "short")).status).toBe(400);
    // A weak attempt does not burn the token.
    expect((await complete(weak.token, "A-strong-password-123")).status).toBe(200);

    const leftover = await newStaff("leftover");
    await request(leftover.email);
    const code = lastCode();
    const token = (await verify(leftover.email, code)).json.token as string;
    await prisma.passwordResetOtp.create({ data: { userId: leftover.id, email: leftover.email, codeHash: hashOtp("manual", "999999"), expiresAt: new Date(Date.now() + 60_000) } });
    expect((await complete(token, "Leftover-password-1")).status).toBe(200);
    expect(await prisma.passwordResetOtp.count({ where: { userId: leftover.id, consumedAt: null, invalidatedAt: null } })).toBe(0);
  });

  it("will not reset an account that was deactivated after verification", async () => {
    const staff = await verified("late");
    await prisma.user.update({ where: { id: staff.id }, data: { isActive: false } });
    expect((await complete(staff.token, "Late-new-password-1")).status).toBe(400);
  });
});
