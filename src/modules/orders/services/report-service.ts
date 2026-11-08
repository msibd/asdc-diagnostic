import { randomBytes, randomInt } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { BRAND_NAME } from "@/lib/brand";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { clientIp, hitRateLimit, refundRateLimit } from "@/lib/rate-limit";
import { formatCents, invoiceTotalCents, paidCents } from "@/modules/billing/services/invoice-math";
import { sendSystemEmail } from "@/modules/email/email-config-service";
import { reportReadyEmail } from "@/modules/email/templates";
import { sendReportReadySms } from "@/modules/sms/sms-service";
import { ageText } from "@/modules/orders/components/order-types";
import {
  VERIFY_ALPHABET, VERIFY_CODE_LENGTH, maskName, normaliseVerifyCode, pinFromPhone, pinMatches, renderReportSms,
  type ReportSnapshot, type SnapshotTest,
} from "@/modules/orders/services/report-rules";
import { OrderError, type AuditRecorder } from "@/modules/orders/services/order-service";

type Db = Prisma.TransactionClient | typeof prisma;

// ---------------------------------------------------------------- building the frozen report

async function letterhead(db: Db): Promise<ReportSnapshot["lab"]> {
  // One after the other: this runs inside a transaction, which has a single connection, and sending
  // two queries down it at once is deprecated in the pg driver (and an error in its next version).
  const content = await db.clinicContent.findUnique({ where: { id: "primary" }, select: { clinicName: true, clinicSubtitle: true } });
  const doctor = await db.doctorProfile.findUnique({ where: { id: "primary" }, select: { address: true, phone: true, email: true } });
  return {
    name: content?.clinicName?.trim() || BRAND_NAME,
    subtitle: content?.clinicSubtitle?.trim() || "Diagnostic Center",
    address: doctor?.address?.trim() || null,
    phone: doctor?.phone?.trim() || null,
    email: doctor?.email?.trim() || null,
  };
}

/** Copies everything a report prints out of the live records. Only an order whose tests are all approved can be reported. */
export async function buildSnapshot(db: Db, orderId: string): Promise<ReportSnapshot> {
  const order = await db.testOrder.findUnique({
    where: { id: orderId },
    select: {
      orderCode: true, orderedAt: true, priority: true, referredBy: true, status: true,
      patient: { select: { name: true, patientCode: true, sex: true, dateOfBirth: true } },
      samples: { select: { collectedAt: true } },
      items: {
        orderBy: { testName: "asc" },
        select: {
          testCode: true, testName: true, resultStatus: true, resultText: true, resultNote: true, verifiedBy: true, verifiedAt: true,
          panel: { select: { name: true } }, test: { select: { category: true } },
          results: { orderBy: { sortOrder: "asc" }, select: { parameterName: true, value: true, unit: true, flag: true, referenceText: true } },
        },
      },
    },
  });
  if (!order) throw new OrderError("Order not found.", 404);
  if (!order.items.length || order.items.some((item) => item.resultStatus !== "VERIFIED")) {
    throw new OrderError("A report can be made only when every test has been approved by the pathologist.", 409);
  }

  const tests: SnapshotTest[] = order.items
    .map((item) => ({
      code: item.testCode,
      name: item.testName,
      category: item.test.category,
      panel: item.panel?.name ?? null,
      parameters: item.results.map((result) => ({ name: result.parameterName, value: result.value, unit: result.unit, flag: result.flag, reference: result.referenceText })),
      text: item.resultText,
      note: item.resultNote,
      verifiedBy: item.verifiedBy,
      verifiedAt: item.verifiedAt?.toISOString() ?? null,
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const collected = order.samples.map((sample) => sample.collectedAt).filter((date): date is Date => date !== null).sort((a, b) => a.getTime() - b.getTime());
  const critical = tests.some((test) => test.parameters.some((parameter) => parameter.flag === "CRITICAL_LOW" || parameter.flag === "CRITICAL_HIGH"));

  return {
    schema: 1,
    lab: await letterhead(db),
    patient: {
      name: order.patient.name,
      code: order.patient.patientCode,
      sex: order.patient.sex,
      age: ageText(order.patient.dateOfBirth ? order.patient.dateOfBirth.toISOString().slice(0, 10) : null, order.orderedAt),
    },
    order: { code: order.orderCode, orderedAt: order.orderedAt.toISOString(), collectedAt: collected[0]?.toISOString() ?? null, priority: order.priority, referredBy: order.referredBy },
    tests,
    verifiedBy: [...new Set(tests.map((test) => test.verifiedBy).filter((name): name is string => Boolean(name)))],
    hasCritical: critical,
  };
}

// ---------------------------------------------------------------- tokens

/** Secret in the patient's link: 144 random bits, URL-safe. */
export const newAccessToken = () => randomBytes(18).toString("base64url");

/** The code under the QR: 12 characters with no look-alikes. Unbiased (randomInt), never derived from anything. */
export function newVerifyCode() {
  let code = "";
  for (let i = 0; i < VERIFY_CODE_LENGTH; i += 1) code += VERIFY_ALPHABET[randomInt(VERIFY_ALPHABET.length)];
  return code;
}

/** Public address of the app: the configured one, else wherever the request came from. */
export function siteOrigin(request: Request) {
  const configured = process.env.BETTER_AUTH_URL?.trim().replace(/\/+$/, "");
  return configured || new URL(request.url).origin;
}

// ---------------------------------------------------------------- releasing and withdrawing

/** Locks the order row for the length of the transaction, so two people cannot release it at once. */
const lockOrder = (tx: Prisma.TransactionClient, orderId: string) => tx.$executeRaw`SELECT 1 FROM "TestOrder" WHERE id = ${orderId} FOR UPDATE`;

export async function releaseReport(orderId: string, actorName: string, record: AuditRecorder) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const order = await tx.testOrder.findUnique({ where: { id: orderId }, select: { id: true, orderCode: true, status: true } });
    if (!order) throw new OrderError("Order not found.", 404);
    if (order.status === "DELIVERED") throw new OrderError("A report has already been released for this order.", 409);
    if (order.status === "CANCELLED") throw new OrderError("This order was cancelled.", 409);
    if (order.status !== "VERIFIED") throw new OrderError("A report can be released only after the pathologist has approved every test.", 409);

    const snapshot = await buildSnapshot(tx, orderId);
    const last = await tx.labReport.aggregate({ where: { orderId }, _max: { version: true } });
    const [seq] = await tx.$queryRaw<{ value: string }[]>`SELECT nextval('"report_code_seq"')::text AS value`;
    const report = await tx.labReport.create({
      data: {
        reportCode: `RPT-${seq.value.padStart(6, "0")}`,
        orderId,
        version: (last._max.version ?? 0) + 1,
        accessToken: newAccessToken(),
        verifyCode: newVerifyCode(),
        snapshot: snapshot as unknown as Prisma.InputJsonValue,
        issuedBy: actorName,
      },
    });
    await tx.testOrder.update({ where: { id: orderId }, data: { status: "DELIVERED" } });
    await record(tx, "RELEASE", "LabReport", report.id, { reportCode: report.reportCode, orderCode: order.orderCode, version: report.version, critical: snapshot.hasCritical });
    return report;
  });
}

/**
 * Takes a released report back (a mistake was found). Its link stops showing results at once, the
 * order returns to "verified" so the pathologist can reopen and correct the tests, and a new report
 * can then be released as the next version.
 */
export async function withdrawReport(orderId: string, reason: string, actorName: string, record: AuditRecorder) {
  return prisma.$transaction(async (tx) => {
    await lockOrder(tx, orderId);
    const report = await tx.labReport.findFirst({ where: { orderId, status: "ISSUED" }, include: { order: { select: { orderCode: true } } } });
    if (!report) throw new OrderError("There is no released report to withdraw.", 409);
    await tx.labReport.update({ where: { id: report.id }, data: { status: "WITHDRAWN", withdrawnBy: actorName, withdrawnAt: new Date(), withdrawReason: reason } });
    await tx.testOrder.update({ where: { id: orderId }, data: { status: "VERIFIED" } });
    await record(tx, "WITHDRAW", "LabReport", report.id, { reportCode: report.reportCode, orderCode: report.order.orderCode, reason });
    return report.id;
  });
}

// ---------------------------------------------------------------- what the staff screen shows

export async function loadReportView(orderId: string, origin: string) {
  const order = await prisma.testOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true, orderCode: true, status: true,
      patient: { select: { phone: true, email: true } },
      invoice: { select: { subtotal: true, discount: true, tax: true, payments: { select: { amount: true, status: true } } } },
      reports: { orderBy: { version: "desc" } },
    },
  });
  if (!order) return null;

  const issued = order.reports.find((report) => report.status === "ISSUED") ?? null;
  // Before release the screen can still show what the report will look like.
  const preview = !issued && order.status === "VERIFIED" ? await buildSnapshot(prisma, orderId) : null;
  const total = order.invoice ? invoiceTotalCents(order.invoice) : 0;
  const paid = order.invoice ? paidCents(order.invoice.payments.filter((payment) => payment.status === "POSTED")) : 0;

  return {
    orderCode: order.orderCode,
    status: order.status,
    due: formatCents(Math.max(total - paid, 0)),
    pinHint: pinFromPhone(order.patient.phone) !== null,
    canEmail: Boolean(order.patient.email),
    preview,
    report: issued && {
      id: issued.id, reportCode: issued.reportCode, version: issued.version, issuedAt: issued.issuedAt, issuedBy: issued.issuedBy,
      verifyCode: issued.verifyCode, verifyUrl: `${origin}/verify/${issued.verifyCode}`, link: `${origin}/r/${issued.accessToken}`,
      smsSentAt: issued.smsSentAt, emailSentAt: issued.emailSentAt, firstViewedAt: issued.firstViewedAt, viewCount: issued.viewCount,
      snapshot: issued.snapshot as unknown as ReportSnapshot,
    },
    history: order.reports.map((report) => ({ id: report.id, reportCode: report.reportCode, version: report.version, status: report.status, issuedAt: report.issuedAt, issuedBy: report.issuedBy, withdrawnAt: report.withdrawnAt, withdrawnBy: report.withdrawnBy, withdrawReason: report.withdrawReason })),
  };
}

// ---------------------------------------------------------------- sending the link

export type SendOutcome = { ok: boolean; message: string };

/** Texts or e-mails the patient the link to their report. Never throws: the outcome says what happened. */
export async function sendReportLink(orderId: string, channel: "sms" | "email", actor: { id: string; name: string }, origin: string, record: AuditRecorder): Promise<SendOutcome> {
  const report = await prisma.labReport.findFirst({
    where: { orderId, status: "ISSUED" },
    include: { order: { select: { orderCode: true, patient: { select: { name: true, phone: true, email: true } } } } },
  });
  if (!report) return { ok: false, message: "Release the report first." };
  const { patient, orderCode } = report.order;
  if (!pinFromPhone(patient.phone)) return { ok: false, message: "This patient's phone number is too short to use as a PIN, so the report cannot be opened online. Print it instead." };

  const snapshot = report.snapshot as unknown as ReportSnapshot;
  const link = `${origin}/r/${report.accessToken}`;
  let outcome: SendOutcome;
  try {
    if (channel === "sms") {
      outcome = await sendReportReadySms({ to: patient.phone, text: renderReportSms({ lab: snapshot.lab.name, name: patient.name, orderCode, link }), actorId: actor.id });
    } else {
      if (!patient.email) return { ok: false, message: "This patient has no e-mail address on file." };
      const result = await sendSystemEmail(patient.email, reportReadyEmail({ name: patient.name, orderCode, link, lab: snapshot.lab.name }), { action: "REPORT_READY", actorId: actor.id });
      outcome = result.ok ? { ok: true, message: "E-mail accepted by the mail server." } : { ok: false, message: result.code === "DISABLED" ? "E-mail is turned off. Turn it on in E-mail settings." : result.message };
    }
  } catch (error) {
    logger.error("Report link could not be sent.", { error, channel, orderId });
    return { ok: false, message: "The message could not be sent. Try again in a moment." };
  }

  if (outcome.ok) {
    await prisma.$transaction(async (tx) => {
      await tx.labReport.update({ where: { id: report.id }, data: channel === "sms" ? { smsSentAt: new Date() } : { emailSentAt: new Date() } });
      await record(tx, channel === "sms" ? "SEND_SMS" : "SEND_EMAIL", "LabReport", report.id, { reportCode: report.reportCode, orderCode });
    });
  }
  return outcome;
}

// ---------------------------------------------------------------- the patient's side

const PIN_ATTEMPTS = 5;
const PIN_WINDOW_SECONDS = 15 * 60;

export type PublicReport =
  | { kind: "report"; reportCode: string; version: number; issuedAt: Date; verifyCode: string; snapshot: ReportSnapshot }
  | { kind: "withdrawn"; reportCode: string }
  | { kind: "wrong-pin" }
  | { kind: "limited"; retryAfter: number }
  | { kind: "not-found" };

/**
 * Opens a report from the patient's link and PIN. Wrong guesses are counted per link and per address
 * (so neither one link nor one visitor can try all 10,000 PINs); the check fails CLOSED if the counter
 * cannot be reached. A withdrawn report shows no results, only that it was withdrawn.
 */
export async function openReport(token: string, pin: string, request: Request): Promise<PublicReport> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { kind: "not-found" };
  const report = await prisma.labReport.findUnique({
    where: { accessToken: token },
    include: { order: { select: { patient: { select: { phone: true } } } } },
  });
  if (!report) return { kind: "not-found" };

  // Every attempt is counted up front; a correct PIN gives its attempt back, so only wrong guesses
  // use up the allowance (a patient can open their own report as often as they like).
  const linkKey = `report-pin:link:${report.id}`;
  const addressKey = `report-pin:ip:${clientIp(request)}`;
  const perLink = await hitRateLimit(linkKey, PIN_ATTEMPTS, PIN_WINDOW_SECONDS);
  const perAddress = await hitRateLimit(addressKey, PIN_ATTEMPTS * 4, PIN_WINDOW_SECONDS);
  const limited = perLink.limited ? perLink : perAddress.limited ? perAddress : null;
  if (limited) return { kind: "limited", retryAfter: limited.retryAfter };

  if (!pinMatches(report.order.patient.phone, pin)) return { kind: "wrong-pin" };
  await Promise.all([refundRateLimit(linkKey), refundRateLimit(addressKey)]);
  if (report.status === "WITHDRAWN") return { kind: "withdrawn", reportCode: report.reportCode };

  await prisma.labReport.update({ where: { id: report.id }, data: { viewCount: { increment: 1 }, ...(report.firstViewedAt ? {} : { firstViewedAt: new Date() }) } });
  return { kind: "report", reportCode: report.reportCode, version: report.version, issuedAt: report.issuedAt, verifyCode: report.verifyCode, snapshot: report.snapshot as unknown as ReportSnapshot };
}

/** What the public "is this report genuine?" page may say: no results, and the name only masked. */
export async function lookupVerification(input: string) {
  const code = normaliseVerifyCode(input);
  if (!code) return null;
  const report = await prisma.labReport.findUnique({ where: { verifyCode: code }, select: { reportCode: true, version: true, status: true, issuedAt: true, withdrawnAt: true, snapshot: true } });
  if (!report) return null;
  const snapshot = report.snapshot as unknown as ReportSnapshot;
  return {
    reportCode: report.reportCode,
    version: report.version,
    status: report.status,
    issuedAt: report.issuedAt,
    withdrawnAt: report.withdrawnAt,
    lab: snapshot.lab.name,
    patient: maskName(snapshot.patient.name),
    tests: snapshot.tests.length,
  };
}
