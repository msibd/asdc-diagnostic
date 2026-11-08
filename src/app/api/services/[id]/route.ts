import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { feeRangeCheck, feeRangeError, servicePublicFields } from "@/modules/clinic/schemas/service-public-fields";
import { catalogRulesError, testCatalogFields } from "@/modules/clinic/schemas/test-catalog";
import { detailInclude, replaceParameters, replacePanelMembers, serializeService } from "@/modules/clinic/services/test-catalog";
import { invalidatePublicCache, publicCacheTags } from "@/lib/public-cache";

const updateSchema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Za-z0-9_-]+$/),
  name: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).nullable(),
  ...servicePublicFields,
  ...testCatalogFields,
  standardPrice: z.number().finite().min(0).max(99999999),
  durationMinutes: z.number().int().min(5).max(600),
  isActive: z.boolean(),
}).refine(feeRangeCheck, feeRangeError);

class CatalogError extends Error {}

/** One row with its parameters, reference ranges and panel members: what the edit form loads. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "services:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const { id } = await params;
  const service = await prisma.clinicService.findUnique({ where: { id }, include: detailInclude });
  if (!service) return NextResponse.json({ error: "Service not found." }, { status: 404 });
  return NextResponse.json({ service: serializeService(service) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await authorize(request.headers, "services:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid service." }, { status: 400 });
  const rules = catalogRulesError(parsed.data, false);
  if (rules) return NextResponse.json({ error: rules.message }, { status: 400 });
  const { id } = await params;
  // Parameters and panel members are replaced only when the request carries them, so the
  // enable/disable toggle (which sends neither) never wipes a test's definition.
  const { parameters, panelTestIds, ...data } = parsed.data;
  try {
    const service = await prisma.$transaction(async (tx) => {
      await tx.clinicService.update({ where: { id }, data });
      if (parameters) await replaceParameters(tx, id, parameters);
      if (panelTestIds) {
        const problem = await replacePanelMembers(tx, id, panelTestIds);
        if (problem) throw new CatalogError(problem);
      }
      return tx.clinicService.findUniqueOrThrow({ where: { id }, include: detailInclude });
    });
    await writeAuditEvent(request, access.session.user.id, "UPDATE", "ClinicService", id);
    invalidatePublicCache(publicCacheTags.clinic);
    return NextResponse.json({ service: serializeService(service) });
  } catch (error) {
    if (error instanceof CatalogError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (typeof error === "object" && error !== null && "code" in error) {
      if (error.code === "P2025") return NextResponse.json({ error: "Service not found." }, { status: 404 });
      if (error.code === "P2002") return NextResponse.json({ error: "Service code or name is already in use." }, { status: 409 });
    }
    throw error;
  }
}
