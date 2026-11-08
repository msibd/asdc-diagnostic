import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { invalidatePublicCache, publicCacheTags } from "@/lib/public-cache";

const imageSchema = z.object({
  url: z.string().trim().url().max(2048).refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === "https:" || protocol === "http:";
  }, "Image URL must use HTTP or HTTPS."),
  altText: z.string().trim().min(2).max(240),
  sortOrder: z.number().int().min(0).max(10000),
});

async function requireAdmin(request: Request) {
  const access = await authorize(request.headers, "website:manage");
  if (!access.session) {
    return {
      session: null,
      response: NextResponse.json({ error: access.error }, { status: access.status }),
    };
  }
  return { session: access.session, response: null };
}

async function readJson(request: Request) {
  try {
    return await request.json() as unknown;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const access = await requireAdmin(request);
  if (!access.session) return access.response;

  const images = await prisma.clinicGalleryImage.findMany({
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ images });
}

export async function POST(request: Request) {
  const access = await requireAdmin(request);
  if (!access.session) return access.response;

  const payload = await readJson(request);
  const parsed = imageSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid image data." }, { status: 400 });
  }

  const image = await prisma.clinicGalleryImage.create({ data: parsed.data });
  await writeAuditEvent(request, access.session.user.id, "CREATE", "ClinicGalleryImage", image.id, {
    url: image.url,
    sortOrder: image.sortOrder,
  });
  invalidatePublicCache(publicCacheTags.gallery);
  return NextResponse.json({ image }, { status: 201 });
}

export async function PATCH(request: Request) {
  const access = await requireAdmin(request);
  if (!access.session) return access.response;

  const payload = await readJson(request);
  const id = typeof payload === "object" && payload !== null && "id" in payload ? payload.id : undefined;
  const parsed = imageSchema.safeParse(
    typeof payload === "object" && payload !== null
      ? { url: "url" in payload ? payload.url : undefined, altText: "altText" in payload ? payload.altText : undefined, sortOrder: "sortOrder" in payload ? payload.sortOrder : undefined }
      : payload,
  );
  if (typeof id !== "string" || !id || !parsed.success) {
    return NextResponse.json({ error: parsed.success ? "An image ID is required." : parsed.error.issues[0]?.message }, { status: 400 });
  }

  try {
    const image = await prisma.clinicGalleryImage.update({ where: { id }, data: parsed.data });
    await writeAuditEvent(request, access.session.user.id, "UPDATE", "ClinicGalleryImage", image.id, {
      url: image.url,
      sortOrder: image.sortOrder,
    });
    invalidatePublicCache(publicCacheTags.gallery);
    return NextResponse.json({ image });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Gallery image not found." }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(request: Request) {
  const access = await requireAdmin(request);
  if (!access.session) return access.response;

  const payload = await readJson(request);
  const id = typeof payload === "object" && payload !== null && "id" in payload ? payload.id : undefined;
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "An image ID is required." }, { status: 400 });
  }

  try {
    const image = await prisma.clinicGalleryImage.delete({ where: { id } });
    await writeAuditEvent(request, access.session.user.id, "DELETE", "ClinicGalleryImage", image.id, {
      url: image.url,
    });
    invalidatePublicCache(publicCacheTags.gallery);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Gallery image not found." }, { status: 404 });
    }
    throw error;
  }
}
