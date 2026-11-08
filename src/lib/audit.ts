import { prisma } from "@/lib/prisma";

// Either the global client or a transaction client, so an audit entry can commit (or roll back)
// together with the change it describes.
type AuditClient = Pick<typeof prisma, "auditEvent">;

export async function writeAuditEvent(
  request: Request,
  actorId: string,
  action: string,
  entity: string,
  entityId?: string,
  details?: Record<string, string | number | boolean | null>,
  db: AuditClient = prisma,
) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip");

  await db.auditEvent.create({
    data: {
      actorId,
      action,
      entity,
      entityId,
      details,
      ipAddress,
    },
  });
}
