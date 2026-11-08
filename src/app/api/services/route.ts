import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { catalogRulesError } from "@/modules/clinic/schemas/test-catalog";
import { serviceSchema } from "@/modules/clinic/schemas/service-create";
import { detailInclude, listInclude, replaceParameters, replacePanelMembers, serializeService } from "@/modules/clinic/services/test-catalog";
import { invalidatePublicCache, publicCacheTags } from "@/lib/public-cache";

class CatalogError extends Error {}

export async function GET(request: Request) {
  const access = await authorize(request.headers, "services:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const url = new URL(request.url);
  const includeInactive = url.searchParams.get("includeInactive") === "true";
  const kind = url.searchParams.get("kind");
  const services = await prisma.clinicService.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(kind === "SERVICE" || kind === "TEST" || kind === "PANEL" ? { kind } : {}),
    },
    include: listInclude,
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({ services: services.map(serializeService) });
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "services:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = serviceSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid service." }, { status: 400 });
  const rules = catalogRulesError(parsed.data, true);
  if (rules) return NextResponse.json({ error: rules.message }, { status: 400 });
  const { parameters, panelTestIds, ...data } = parsed.data;
  try {
    const service = await prisma.$transaction(async (tx) => {
      const created = await tx.clinicService.create({ data });
      if (parameters?.length) await replaceParameters(tx, created.id, parameters);
      if (panelTestIds?.length) {
        const problem = await replacePanelMembers(tx, created.id, panelTestIds);
        if (problem) throw new CatalogError(problem);
      }
      return tx.clinicService.findUniqueOrThrow({ where: { id: created.id }, include: detailInclude });
    });
    await writeAuditEvent(request, access.session.user.id, "CREATE", "ClinicService", service.id);
    invalidatePublicCache(publicCacheTags.clinic);
    return NextResponse.json({ service: serializeService(service) }, { status: 201 });
  } catch (error) {
    if (error instanceof CatalogError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Service code or name is already in use." }, { status: 409 });
    }
    throw error;
  }
}
