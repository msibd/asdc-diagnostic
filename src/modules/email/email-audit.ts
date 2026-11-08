import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

type AuditClient = Pick<typeof prisma, "emailAuditLog">;

/** "a***@d***.com": enough to recognise an address in the history, not enough to reuse it. */
export function maskEmail(address: string) {
  const [local = "", domain = ""] = address.toLowerCase().split("@");
  const [name = "", ...rest] = domain.split(".");
  return `${local.slice(0, 1)}***@${name.slice(0, 1)}***${rest.length ? `.${rest.join(".")}` : ""}`;
}

/** One line in the e-mail history. Never pass codes, passwords or message bodies. */
export async function writeEmailAudit(
  entry: {
    action: string;
    status: "SUCCESS" | "FAILED" | "INFO";
    actorId?: string | null;
    recipient?: string | null;
    message?: string | null;
    details?: Record<string, string | number | boolean | null>;
  },
  db: AuditClient = prisma,
) {
  try {
    await db.emailAuditLog.create({
      data: {
        action: entry.action,
        status: entry.status,
        actorId: entry.actorId ?? null,
        recipient: entry.recipient ? maskEmail(entry.recipient) : null,
        message: entry.message?.slice(0, 300) ?? null,
        details: entry.details,
      },
    });
  } catch (error) {
    // A failed history write must never block the action it describes.
    logger.error("Could not write the e-mail audit log.", { error, action: entry.action });
  }
}
