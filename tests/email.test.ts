import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// No test ever opens a network connection: nodemailer is replaced by a recorder.
const mail = vi.hoisted(() => ({
  verify: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn(),
  createTransport: vi.fn(),
}));
vi.mock("nodemailer", () => {
  mail.createTransport.mockImplementation(() => ({ verify: mail.verify, sendMail: mail.sendMail, close: mail.close }));
  return { default: { createTransport: mail.createTransport } };
});

import { GET as getHistory } from "@/app/api/email/history/route";
import { GET as getSettings, PUT as putSettings } from "@/app/api/email/settings/route";
import { POST as testConnection } from "@/app/api/email/test-connection/route";
import { POST as testSend } from "@/app/api/email/test-send/route";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, needsReencryption, SecretBoxError } from "@/modules/email/secret-box";
import { buildTransportOptions, describeMailError } from "@/modules/email/mailer";
import { passwordChangedEmail, passwordResetOtpEmail, emailTestEmail } from "@/modules/email/templates";
import { call, createSession, type TestUser } from "./helpers";

let admin: TestUser;
let receptionist: TestUser;

const PASSWORD = "abcd efgh ijkl mnop";
const valid = (overrides: Record<string, unknown> = {}) => ({
  provider: "gmail", host: "smtp.gmail.com", port: 465, secure: true, authMethod: "APP_PASSWORD",
  username: "clinic@gmail.com", password: PASSWORD, senderEmail: "clinic@gmail.com", senderName: "Dr Ovi Dental", enabled: false,
  ...overrides,
});
const save = (body: Record<string, unknown>, cookie = admin.cookie) => call(putSettings, "/api/email/settings", { method: "PUT", cookie, body });
const read = (cookie = admin.cookie) => call(getSettings, "/api/email/settings", { cookie });
const connect = (cookie = admin.cookie) => call(testConnection, "/api/email/test-connection", { method: "POST", cookie });
const sendTest = (to: string, cookie = admin.cookie) => call(testSend, "/api/email/test-send", { method: "POST", cookie, body: { to } });

beforeAll(async () => {
  admin = await createSession("admin");
  receptionist = await createSession("receptionist");
});

beforeEach(async () => {
  mail.verify.mockReset().mockResolvedValue(true);
  mail.sendMail.mockReset().mockImplementation(async (message: { to: string }) => ({ accepted: [message.to], rejected: [], messageId: "<test@id>", response: "250 OK" }));
  mail.close.mockReset();
  mail.createTransport.mockClear();
  await prisma.emailConfiguration.deleteMany();
});

describe("encryption of stored secrets", () => {
  it("round-trips, and never produces the same ciphertext twice", () => {
    const first = encryptSecret("s3cret-app-password");
    const second = encryptSecret("s3cret-app-password");
    expect(first).not.toBe(second);
    expect(first).not.toContain("s3cret");
    expect(decryptSecret(first)).toBe("s3cret-app-password");
  });

  it("refuses altered or foreign data", () => {
    const stored = encryptSecret("value");
    const parts = stored.split(".");
    const tampered = [...parts.slice(0, 4), Buffer.from("different").toString("base64url")].join(".");
    expect(() => decryptSecret(tampered)).toThrow(SecretBoxError);
    expect(() => decryptSecret("not-a-secret")).toThrow(SecretBoxError);
    expect(() => decryptSecret(["v1", "deadbeef", ...parts.slice(2)].join("."))).toThrow(/no longer configured/);
  });

  it("opens values made with the previous key and flags them for re-encryption", () => {
    const original = process.env.EMAIL_ENCRYPTION_KEY;
    const stored = encryptSecret("rotating");
    try {
      process.env.EMAIL_ENCRYPTION_KEY_PREVIOUS = original;
      process.env.EMAIL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
      expect(decryptSecret(stored)).toBe("rotating");
      expect(needsReencryption(stored)).toBe(true);
      expect(needsReencryption(encryptSecret("fresh"))).toBe(false);
    } finally {
      process.env.EMAIL_ENCRYPTION_KEY = original;
      delete process.env.EMAIL_ENCRYPTION_KEY_PREVIOUS;
    }
  });
});

describe("access to e-mail settings", () => {
  it("is for administrators only", async () => {
    expect((await call(getSettings, "/api/email/settings")).status).toBe(401);
    expect((await read(receptionist.cookie)).status).toBe(403);
    expect((await save(valid(), receptionist.cookie)).status).toBe(403);
    expect((await connect(receptionist.cookie)).status).toBe(403);
    expect((await sendTest("a@example.test", receptionist.cookie)).status).toBe(403);
    expect((await call(getHistory, "/api/email/history", { cookie: receptionist.cookie })).status).toBe(403);
    expect(mail.createTransport).not.toHaveBeenCalled();
  });
});

describe("saving settings", () => {
  it("stores the password encrypted and never returns it", async () => {
    const response = await save(valid());
    expect(response.status).toBe(200);
    expect(response.json.settings.passwordSet).toBe(true);
    expect(JSON.stringify(response.json)).not.toMatch(/abcd|efgh|encryptedPassword|"password":/i);

    const row = await prisma.emailConfiguration.findUniqueOrThrow({ where: { id: "primary" } });
    expect(row.encryptedPassword).toBeTruthy();
    expect(row.encryptedPassword).not.toContain("abcd");
    expect(decryptSecret(row.encryptedPassword!)).toBe(PASSWORD);

    const fetched = await read();
    expect(fetched.json.encryptionConfigured).toBe(true);
    expect(fetched.json.settings.username).toBe("clinic@gmail.com");
    expect(JSON.stringify(fetched.json)).not.toMatch(/abcd|efgh|encryptedPassword/i);
  });

  it("keeps the saved password when none is sent, and replaces it when one is (rotation)", async () => {
    await save(valid());
    const before = (await prisma.emailConfiguration.findUniqueOrThrow({ where: { id: "primary" } })).encryptedPassword;
    expect((await save(valid({ password: undefined, senderName: "Renamed Clinic" }))).status).toBe(200);
    expect((await prisma.emailConfiguration.findUniqueOrThrow({ where: { id: "primary" } })).encryptedPassword).toBe(before);

    expect((await save(valid({ password: "new new new new" }))).status).toBe(200);
    const after = await prisma.emailConfiguration.findUniqueOrThrow({ where: { id: "primary" } });
    expect(after.encryptedPassword).not.toBe(before);
    expect(decryptSecret(after.encryptedPassword!)).toBe("new new new new");
  });

  it("validates input", async () => {
    expect((await save(valid({ password: undefined }))).status).toBe(400); // first save needs a password
    expect((await save(valid({ username: "not-an-email" }))).status).toBe(400);
    expect((await save(valid({ port: 70000 }))).status).toBe(400);
    expect((await save(valid({ senderName: "Evil\r\nBcc: x@y.z" }))).status).toBe(400);
    expect((await save(valid({ host: "bad host!" }))).status).toBe(400);
  });

  it("refuses mail servers on local or private networks", async () => {
    for (const host of ["localhost", "127.0.0.1", "192.168.1.5", "10.0.0.9", "169.254.169.254", "mail.internal"]) {
      const response = await save(valid({ provider: "custom", host }));
      expect(response.status, host).toBe(400);
      expect(response.json.error).toMatch(/private or local/i);
    }
  });

  it("will not switch e-mail on before the connection has been tested, and resets after changes", async () => {
    await save(valid());
    expect((await save(valid({ password: undefined, enabled: true }))).status).toBe(409);

    const tested = await connect();
    expect(tested.status).toBe(200);
    expect(tested.json.ok).toBe(true);
    expect(tested.json.settings.lastTestStatus).toBe("SUCCESS");

    const enabled = await save(valid({ password: undefined, enabled: true }));
    expect(enabled.status).toBe(200);
    expect(enabled.json.settings.enabled).toBe(true);

    // Changing the connection clears the test result, so it cannot stay on untested.
    expect((await save(valid({ password: undefined, port: 587, secure: false, enabled: true }))).status).toBe(409);
    const changed = await save(valid({ password: undefined, port: 587, secure: false, enabled: false }));
    expect(changed.json.settings.lastTestStatus).toBeNull();
    expect(changed.json.settings.enabled).toBe(false);
  });
});

describe("connection test and test e-mail", () => {
  it("needs saved settings first", async () => {
    expect((await connect()).status).toBe(400);
    expect((await sendTest("someone@example.test")).status).toBe(400);
  });

  it("verifies the connection with the stored password, over TLS, and sends nothing", async () => {
    await save(valid());
    const response = await connect();
    expect(response.json.ok).toBe(true);
    expect(mail.verify).toHaveBeenCalledTimes(1);
    expect(mail.sendMail).not.toHaveBeenCalled();
    const options = mail.createTransport.mock.calls[0][0];
    // The stored password was decrypted, and Google's spaces were dropped.
    expect(options.auth).toEqual({ user: "clinic@gmail.com", pass: "abcdefghijklmnop" });
    expect(options.secure).toBe(true);
    expect(options.tls).toEqual({ minVersion: "TLSv1.2", rejectUnauthorized: true });
    expect(options.connectionTimeout).toBeLessThanOrEqual(15_000);
    expect(options.logger).toBe(false);
    expect(mail.close).toHaveBeenCalled();
  });

  it("requires STARTTLS on a non-TLS port", () => {
    const options = buildTransportOptions({
      host: "smtp.example.com", port: 587, secure: false, authMethod: "PASSWORD", username: "u@example.com", password: "p w",
      senderEmail: "u@example.com", senderName: "X",
    });
    expect(options.requireTLS).toBe(true);
    expect(options.auth?.pass).toBe("p w"); // only app passwords have their spaces removed
  });

  it("reports a failed login in plain words and records it, without the credentials", async () => {
    await save(valid());
    mail.verify.mockRejectedValue(Object.assign(new Error("Invalid login: 535 5.7.8 Username and Password not accepted"), { code: "EAUTH", responseCode: 535 }));
    const response = await connect();
    expect(response.status).toBe(200);
    expect(response.json.ok).toBe(false);
    expect(response.json.message).toMatch(/username or password/i);
    expect(response.json.settings.lastTestStatus).toBe("FAILED");
    expect(JSON.stringify(response.json)).not.toMatch(/abcd|535/);
  });

  it("maps common network failures", () => {
    expect(describeMailError(Object.assign(new Error("x"), { code: "ETIMEDOUT" })).code).toBe("TIMEOUT");
    expect(describeMailError(Object.assign(new Error("x"), { code: "ECONNREFUSED" })).code).toBe("REFUSED");
    expect(describeMailError(Object.assign(new Error("x"), { code: "ENOTFOUND" })).code).toBe("HOST_NOT_FOUND");
    expect(describeMailError(new Error("self signed certificate")).code).toBe("TLS");
    expect(describeMailError(new Error("boom")).code).toBe("FAILED");
  });

  it("sends a test e-mail with HTML and plain text, and only calls it accepted when the server names the recipient", async () => {
    await save(valid());
    const sent = await sendTest("Tester@Example.test");
    expect(sent.status).toBe(200);
    expect(sent.json.ok).toBe(true);
    expect(sent.json.message).toMatch(/accepted/i);
    const message = mail.sendMail.mock.calls[0][0];
    expect(message.to).toBe("tester@example.test");
    expect(message.from).toEqual({ name: "Dr Ovi Dental", address: "clinic@gmail.com" });
    expect(message.html).toContain("<html");
    expect(message.text).toMatch(/test message/i);

    // A server that answers without accepting the recipient is not reported as sent.
    mail.sendMail.mockResolvedValue({ accepted: [], rejected: ["tester@example.test"], response: "550" });
    const refused = await sendTest("tester@example.test");
    expect(refused.json.ok).toBe(false);
    expect(refused.json.message).toMatch(/did not accept/i);

    mail.sendMail.mockRejectedValue(Object.assign(new Error("down"), { code: "ECONNECTION" }));
    expect((await sendTest("tester@example.test")).json.ok).toBe(false);
    expect((await sendTest("not-an-email")).status).toBe(400);
  });

  it("is rate limited", async () => {
    // The limit is per administrator, so use one that no other test touches.
    const tester = await createSession("admin");
    await save(valid());
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) statuses.push((await connect(tester.cookie)).status);
    expect(statuses.slice(0, 10).every((status) => status === 200)).toBe(true);
    expect(statuses.slice(10)).toEqual([429, 429]);
  });
});

describe("history", () => {
  it("lists settings changes and tests with masked addresses and no secrets", async () => {
    await save(valid());
    await connect();
    await sendTest("patient.name@example.test");
    const response = await call(getHistory, "/api/email/history", { cookie: admin.cookie });
    expect(response.status).toBe(200);
    const actions = response.json.history.map((row: { action: string }) => row.action);
    expect(actions).toEqual(expect.arrayContaining(["SETTINGS_UPDATED", "CONNECTION_TEST", "TEST_EMAIL"]));
    const text = JSON.stringify(response.json);
    expect(text).not.toContain("patient.name@example.test");
    expect(text).toContain("p***@e***.test");
    expect(text).not.toMatch(/abcd|efgh|clinic@gmail\.com/);
    expect(response.json.history[0].actor).toBe("Test admin");
  });
});

describe("templates", () => {
  it("shows the code, the expiry and a security warning, and escapes names", () => {
    const content = passwordResetOtpEmail({ name: "<b>Dr</b> & Co", code: "123456", expiresInMinutes: 5 });
    expect(content.subject).toContain("123456");
    expect(content.html).toContain("123456");
    expect(content.html).toContain("5 minutes");
    expect(content.html).toMatch(/Keep this code private/);
    expect(content.html).toContain("viewport");
    expect(content.html).not.toContain("<b>Dr</b>");
    expect(content.html).toContain("&lt;b&gt;Dr&lt;/b&gt;");
    expect(content.text).toContain("123456");
    // Plain text carries no HTML markup of its own.
    expect(content.text).not.toMatch(/<(html|table|div|p)/i);
  });

  it("covers the test and password-changed messages without patient information", () => {
    const test = emailTestEmail({ senderName: "Clinic", host: "smtp.gmail.com", port: 465 });
    expect(test.subject).toMatch(/test/i);
    expect(test.html).toContain("smtp.gmail.com:465");
    const changed = passwordChangedEmail({ name: "Dr Ovi" });
    expect(changed.subject).toMatch(/changed/i);
    expect(changed.html).toMatch(/Was this not you/);
  });
});
