import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { invalidatePublicCache, publicCacheTags } from "@/lib/public-cache";
import { MapLinkError, resolveMapLink } from "@/modules/website/map-link";
import { isSafeMapEmbed } from "@/modules/website/schemas/website-layout";
import { readWebsiteContent } from "@/modules/website/queries/website-content";
import { websiteContentFieldErrors, websiteContentSchema } from "@/modules/website/schemas/website-content-schema";

// Admin-side management of the public website's text and images.
export async function GET(request: Request) {
  const access = await authorize(request.headers, "website:manage");
  if (!access.session) return apiError(access.error, access.status);
  return NextResponse.json({ content: await readWebsiteContent() }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const access = await authorize(request.headers, "website:manage");
  if (!access.session) return apiError(access.error, access.status);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("Request body must be valid JSON.", 400);
  }
  const parsed = websiteContentSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors = websiteContentFieldErrors(parsed.error);
    return apiError(parsed.error.issues[0]?.message ?? "Please check the highlighted fields.", 400, { fieldErrors });
  }

  const { heroImageUrl, doctorImageUrl, centreImageUrl, layout: submittedLayout, ...rest } = parsed.data;

  // The map: the browser only sends the link the clinic pasted. The address that goes into the
  // page's frame is worked out here, on the server, and a value sent by the browser is ignored.
  const layout = { ...submittedLayout, mapEmbedUrl: undefined as string | undefined };
  const pasted = submittedLayout.mapUrl?.trim() ?? "";
  if (!pasted) {
    layout.mapUrl = undefined;
  } else {
    const saved = (await readWebsiteContent()).layout;
    if (saved.mapUrl === pasted && isSafeMapEmbed(saved.mapEmbedUrl)) {
      layout.mapEmbedUrl = saved.mapEmbedUrl; // unchanged link: no need to ask Google again
    } else {
      try {
        const resolved = await resolveMapLink(pasted);
        layout.mapUrl = resolved.mapUrl;
        layout.mapEmbedUrl = resolved.embedUrl;
      } catch (error) {
        if (error instanceof MapLinkError) {
          return apiError(error.message, 400, { fieldErrors: { "layout.mapUrl": error.message } });
        }
        throw error;
      }
    }
  }
  const data = { ...rest, layout, heroImageUrl: heroImageUrl || null, doctorImageUrl: doctorImageUrl || null, centreImageUrl: centreImageUrl || null };
  await prisma.clinicContent.upsert({ where: { id: "primary" }, create: { id: "primary", ...data }, update: data });
  await writeAuditEvent(request, access.session.user.id, "UPDATE", "ClinicContent", "primary", {
    fields: Object.keys(parsed.data).join(","),
  });
  // The public site caches this content; expire it so the next visitor sees the change.
  invalidatePublicCache(publicCacheTags.clinic);
  return NextResponse.json({ content: await readWebsiteContent() });
}
