import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enforcePublicRateLimit, publicRateLimits } from "@/lib/rate-limit";
import { getPublishedReviews } from "@/app/public_website/queries/clinic-queries";
import { reviewSubmissionSchema } from "@/modules/website/reviews/review-rules";
import {
  ALREADY_REVIEWED_MESSAGE,
  findRegisteredPatient,
  NOT_A_PATIENT_MESSAGE,
} from "@/modules/website/reviews/review-verification";

export async function GET() {
  const reviews = await getPublishedReviews();
  return NextResponse.json({ reviews }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const limited = await enforcePublicRateLimit(request, publicRateLimits.review);
  if (limited) return limited;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = reviewSubmissionSchema.safeParse(payload);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid review.", fieldErrors }, { status: 400 });
  }

  // Only registered patients can review. The same message is used whatever part did not match, so
  // the form cannot be used to find out which numbers belong to patients.
  const patient = await findRegisteredPatient(parsed.data.phone, parsed.data.name);
  if (!patient) return NextResponse.json({ error: NOT_A_PATIENT_MESSAGE }, { status: 403 });

  const existing = await prisma.clinicReview.findFirst({
    where: { patientId: patient.id, status: { in: ["PENDING", "PUBLISHED"] } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ error: ALREADY_REVIEWED_MESSAGE }, { status: 409 });

  // The mobile number is not stored: the review keeps only the link to the patient record.
  const review = await prisma.clinicReview.create({
    data: {
      name: parsed.data.name.trim(),
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      patientId: patient.id,
    },
  });
  return NextResponse.json({ review: { id: review.id, status: review.status } }, { status: 201 });
}
