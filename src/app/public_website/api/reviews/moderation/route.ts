import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { invalidatePublicCache, publicCacheTags } from "@/lib/public-cache";

const reviewStatusSchema = z.object({
  status: z.enum(["PUBLISHED", "REJECTED"]),
});

export async function GET(request: Request) {
  const access = await authorize(request.headers, "website:manage");
  if (!access.session) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  const reviews = await prisma.clinicReview.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    // Who wrote it, for the clinic only: name and code, never the mobile number.
    include: { patient: { select: { name: true, patientCode: true } } },
  });
  return NextResponse.json({ reviews });
}

export async function PATCH(request: Request) {
  const access = await authorize(request.headers, "website:manage");
  if (!access.session) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const reviewId = typeof payload === "object" && payload !== null && "id" in payload
    ? payload.id
    : undefined;
  const parsed = reviewStatusSchema.safeParse(payload);
  if (typeof reviewId !== "string" || !reviewId || !parsed.success) {
    return NextResponse.json({ error: parsed.success ? "A review ID is required." : parsed.error.issues[0]?.message }, { status: 400 });
  }

  try {
    const review = await prisma.clinicReview.update({
      where: { id: reviewId },
      data: { status: parsed.data.status },
      include: { patient: { select: { name: true, patientCode: true } } },
    });
    await writeAuditEvent(request, access.session.user.id, "UPDATE", "ClinicReview", review.id, {
      status: review.status,
    });
    invalidatePublicCache(publicCacheTags.reviews);
    return NextResponse.json({ review });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Review not found." }, { status: 404 });
    }
    throw error;
  }
}
