import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { EmailContent } from "./templates";

// The only place that talks SMTP. Every route and service sends mail through here, so TLS rules,
// timeouts and error handling are written once.

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  authMethod: "APP_PASSWORD" | "PASSWORD";
  username: string;
  password: string;
  senderEmail: string;
  senderName: string;
};

export type SendOutcome =
  | { ok: true; messageId: string | null; response: string }
  | { ok: false; code: string; message: string };

/**
 * SMTP options with TLS always on: port 465 uses implicit TLS, any other port must upgrade with
 * STARTTLS (a server that cannot is refused rather than falling back to plain text). Certificates
 * are always verified, and TLS older than 1.2 is not accepted.
 */
export function buildTransportOptions(config: MailConfig): SMTPTransport.Options {
  // Google shows app passwords in groups of four letters; the spaces are not part of the password.
  const pass = config.authMethod === "APP_PASSWORD" ? config.password.replace(/\s+/g, "") : config.password;
  return {
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: !config.secure,
    auth: { user: config.username, pass },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    // No connection pooling or logging: nothing about the session (or the credentials) is kept or printed.
    pool: false,
    logger: false,
    debug: false,
  };
}

export function createMailTransport(config: MailConfig) {
  return nodemailer.createTransport(buildTransportOptions(config));
}

/** A readable reason for an SMTP failure. Raw server text is not passed on. */
export function describeMailError(error: unknown): { code: string; message: string } {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : "UNKNOWN";
  const responseCode = typeof error === "object" && error !== null && "responseCode" in error ? Number((error as { responseCode: unknown }).responseCode) : 0;
  if (code === "EAUTH" || responseCode === 535 || responseCode === 534) {
    return { code: "AUTH_FAILED", message: "The mail server rejected the username or password. For Gmail, use an app password (2-step verification must be on), not the account password." };
  }
  if (code === "ETIMEDOUT" || code === "ESOCKET" && /timed? ?out/i.test(String((error as Error).message))) {
    return { code: "TIMEOUT", message: "The mail server did not answer in time. Check the host and port, and that outgoing mail is not blocked." };
  }
  if (code === "ECONNREFUSED") return { code: "REFUSED", message: "The mail server refused the connection. Check the host and port." };
  if (code === "ENOTFOUND" || code === "EDNS") return { code: "HOST_NOT_FOUND", message: "The mail server address could not be found. Check the host name." };
  if (code === "ECONNECTION" || code === "ECONNRESET") return { code: "CONNECTION", message: "The connection to the mail server failed. Check the host, port and the secure (TLS) setting." };
  if (code === "ETLS" || code === "ESOCKET" || /certificate|tls|ssl/i.test(String((error as Error)?.message ?? ""))) {
    return { code: "TLS", message: "A secure (TLS) connection could not be made. Check the port: 465 uses direct TLS, 587 uses STARTTLS." };
  }
  if (code === "EENVELOPE") return { code: "REJECTED", message: "The mail server did not accept the sender or recipient address." };
  return { code: "FAILED", message: "The e-mail could not be sent. Check the settings and try again." };
}

/** Opens a connection and logs in, without sending anything. */
export async function verifyConnection(config: MailConfig): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const transport = createMailTransport(config);
  try {
    await transport.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, ...describeMailError(error) };
  } finally {
    transport.close();
  }
}

/**
 * Sends one message. "ok" means the mail server accepted it for delivery (it named the recipient
 * as accepted); it is not a read receipt, and the server can still bounce it later.
 */
export async function sendMail(config: MailConfig, to: string, content: EmailContent): Promise<SendOutcome> {
  const transport = createMailTransport(config);
  try {
    const info = await transport.sendMail({
      from: { name: config.senderName, address: config.senderEmail },
      to,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });
    const accepted = ((info.accepted ?? []) as unknown[]).map((entry) => String(typeof entry === "object" && entry !== null && "address" in entry ? (entry as { address: string }).address : entry).toLowerCase());
    if (!accepted.includes(to.toLowerCase())) {
      return { ok: false, code: "REJECTED", message: "The mail server did not accept the recipient address." };
    }
    return { ok: true, messageId: info.messageId ?? null, response: String(info.response ?? "").slice(0, 120) };
  } catch (error) {
    return { ok: false, ...describeMailError(error) };
  } finally {
    transport.close();
  }
}
