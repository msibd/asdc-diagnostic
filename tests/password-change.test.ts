import { beforeEach, describe, expect, it, vi } from "vitest";

const mail = vi.hoisted(() => ({ verify: vi.fn(), sendMail: vi.fn(), close: vi.fn(), createTransport: vi.fn() }));
vi.mock("nodemailer", () => {
  mail.createTransport.mockImplementation(() => ({ verify: mail.verify, sendMail: mail.sendMail, close: mail.close }));
  return { default: { createTransport: mail.createTransport } };
});

import { POST as sendCode } from "@/app/api/security/password/code/route";
import { POST as changePassword } from "@/app/api/security/password/route";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptSecret } from "@/modules/email/secret-box";
import { call, createSession, TEST_PASSWORD, type TestUser } from "./helpers";

let ipCounter = 0;
const freshIp = () => `203.0.113.${(ipCounter += 1)}`;
let sent: { to: string; subject: string; text: string }[] = [];
const NEW_PASSWORD = "A-brand-new-Password-2026";

const requestCode = (user: TestUser) =>
  call(sendCode, "/api/security/password/code", { method: "POST", cookie: user.cookie, headers: { "x-forwarded-for": freshIp() } });
const change = (user: TestUser, body: Record<string, unknown>) =>
  call(changePassword, "/api/security/password", { method: "POST", cookie: user.cookie, body, headers: { "x-forwarded-for": freshIp() } });
const lastCode = () => {
  const match = /code is: (\d{6})/.exec(sent.at(-1)?.text ?? "");
  if (!match) throw new Error("No code was e-mailed.");
  return match[1];
};
const wrong = (code: string) => (code === "000000" ? "111111" : "000000");

beforeEach(async () => {
  sent = [];
  mail.verify.mockReset().mockResolvedValue(true);
  mail.close.mockReset();
  mail.sendMail.mockReset().mockImplementation(async (message: { to: string; subject: string; text: string }) => {
    sent.push({ to: message.to, subject: message.subject, text: message.text });
    return { accepted: [message.to], rejected: [], messageId: "<id>", response: "250 OK" };
  });
  await prisma.emailConfiguration.deleteMany();
  await prisma.emailConfiguration.create({
    data: {
      id: "primary", provider: "gmail", host: "smtp.gmail.com", port: 465, secure: true, authMethod: "APP_PASSWORD",
      username: "clinic@gmail.com", encryptedPassword: encryptSecret("abcdefghijklmnop"), senderEmail: "clinic@gmail.com",
      senderName: "Clinic", enabled: true, lastTestStatus: "SUCCESS",
    },
  });
});

describe("changing your own password needs an e-mailed code", () => {
  it("is closed to signed-out visitors and to accounts with no clinic access", async () => {
    expect((await call(sendCode, "/api/security/password/code", { method: "POST" })).status).toBe(401);
    expect((await call(changePassword, "/api/security/password", { method: "POST", body: {} })).status).toBe(401);
    const noAccess = await createSession("user");
    expect((await requestCode(noAccess)).status).toBe(403);
    expect((await change(noAccess, { currentPassword: "x", newPassword: NEW_PASSWORD, code: "123456" })).status).toBe(403);
  });

  it("is open to every staff member, not only those who may read the audit log", async () => {
    const receptionist = await createSession("receptionist");
    const requested = await requestCode(receptionist);
    expect(requested.status).toBe(200);
    // The code goes to the receptionist's own address, never anyone else's.
    expect(sent.at(-1)?.to).toBe(receptionist.email);
    // A wrong code is refused as an invalid request, not as a permission problem.
    const refused = await change(receptionist, { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD, code: wrong(lastCode()) });
    expect(refused.status).not.toBe(403);
    expect(refused.status).not.toBe(200);
  });

  it("sends the code only to the signed-in user's own address, and the password changes after the right code", async () => {
    const admin = await createSession("admin");
    const first = await requestCode(admin);
    expect(first.status).toBe(200);
    expect(first.json.email).toMatch(/\*+@example\.test$/);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(admin.email);
    expect(sent[0].subject).toMatch(/password change code/);
    const code = lastCode();

    // A wrong current password, a wrong code and a short password are all refused; the code survives a typo.
    expect((await change(admin, { currentPassword: "not-my-password", newPassword: NEW_PASSWORD, code })).json.error).toMatch(/current password/i);
    expect((await change(admin, { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD, code: wrong(code) })).status).toBe(400);
    expect((await change(admin, { currentPassword: TEST_PASSWORD, newPassword: "short", code })).status).toBe(400);

    const done = await changePassword(new Request("http://localhost:3000/api/security/password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: admin.cookie, "x-forwarded-for": freshIp() },
      body: JSON.stringify({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD, code }),
    }));
    expect(done.status).toBe(200);
    expect(sent.at(-1)?.subject).not.toMatch(/code/i); // the "your password was changed" notice
    // The person who changed it stays signed in: the reply carries a fresh session cookie.
    const freshCookie = done.headers.getSetCookie().map((cookie) => cookie.split(";")[0]).join("; ");
    expect(freshCookie).toMatch(/session_token/);
    expect((await requestCode({ ...admin, cookie: freshCookie })).status).toBe(200);
    expect(await prisma.auditEvent.count({ where: { actorId: admin.id, action: "PASSWORD_CHANGE" } })).toBe(1);
    await expect(auth.api.signInEmail({ body: { email: admin.email, password: NEW_PASSWORD } })).resolves.toBeTruthy();
    await expect(auth.api.signInEmail({ body: { email: admin.email, password: TEST_PASSWORD } })).rejects.toBeTruthy();

    // The code works once.
    expect((await change({ ...admin, cookie: freshCookie }, { currentPassword: NEW_PASSWORD, newPassword: `${NEW_PASSWORD}-2`, code })).status).toBe(400);
  });

  it("asks to wait before sending another code", async () => {
    const admin = await createSession("admin");
    expect((await requestCode(admin)).status).toBe(200);
    const again = await requestCode(admin);
    expect(again.status).toBe(429);
    expect(again.json.retryAfter).toBeGreaterThan(0);
    expect(sent).toHaveLength(1);
  });

  it("cancels the code after five wrong guesses", async () => {
    const admin = await createSession("admin");
    await requestCode(admin);
    const code = lastCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await change(admin, { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD, code: wrong(code) })).status).toBe(400);
    }
    expect((await change(admin, { currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD, code })).status).toBe(400);
    await expect(auth.api.signInEmail({ body: { email: admin.email, password: TEST_PASSWORD } })).resolves.toBeTruthy();
  });

  it("does not leave a usable code behind when e-mail is off", async () => {
    await prisma.emailConfiguration.deleteMany();
    const admin = await createSession("admin");
    const result = await requestCode(admin);
    expect(result.status).toBe(503);
    expect(result.json.error).toMatch(/not set up/i);
    expect(await prisma.passwordResetOtp.count({ where: { userId: admin.id, invalidatedAt: null, consumedAt: null } })).toBe(0);
  });

  it("closes the direct change-password route that skips the code", async () => {
    const admin = await createSession("admin");
    const response = await auth.handler(new Request("http://localhost:3000/api/auth/change-password", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: admin.cookie, origin: "http://localhost:3000" },
      body: JSON.stringify({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD }),
    }));
    expect(response.status).toBe(404);
    await expect(auth.api.signInEmail({ body: { email: admin.email, password: TEST_PASSWORD } })).resolves.toBeTruthy();
  });
});
