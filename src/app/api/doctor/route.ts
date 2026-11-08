import { NextResponse } from "next/server";
import { z } from "zod";
import { authorize } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { writeAuditEvent } from "@/lib/audit";
import { invalidatePublicCache, publicCacheTags } from "@/lib/public-cache";
import { PRIMARY_DOCTOR_ID, scheduleSchema } from "@/modules/doctors/doctor-schema";
import { availableSlug, replaceSchedules, newlyStrandedBookings } from "@/modules/doctors/doctor-service";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  qualifications: z.string().trim().max(500).default(""),
  specialization: z.string().trim().min(1).max(120),
  registrationNumber: z.string().trim().max(80).nullable(),
  consultationFee: z.number().finite().min(0).max(99999999),
  phone: z.string().trim().max(30).nullable(),
  email: z.union([z.email(), z.literal(""), z.null()]).transform((value) => value || null),
  address: z.string().trim().max(1000).nullable(),
  bio: z.string().trim().max(3000).nullable(),
  schedules: scheduleSchema,
});

export async function GET(request: Request) {
  const access = await authorize(request.headers, "doctor:read");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: "primary" },
    include: { schedules: { orderBy: { dayOfWeek: "asc" } } },
  });
  return NextResponse.json({ doctor });
}

export async function PUT(request: Request) {
  const access = await authorize(request.headers, "doctor:write");
  if (!access.session) return NextResponse.json({ error: access.error }, { status: access.status });
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = profileSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid doctor profile." }, { status: 400 });

  const { schedules, ...profile } = parsed.data;
  const saved = await prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(41680271)`;
    if ((await newlyStrandedBookings(transaction, PRIMARY_DOCTOR_ID, schedules)).length) return null;

    const existing = await transaction.doctorProfile.findUnique({ where: { id: PRIMARY_DOCTOR_ID }, select: { id: true } });
    const saved = existing
      ? await transaction.doctorProfile.update({ where: { id: PRIMARY_DOCTOR_ID }, data: profile })
      : await transaction.doctorProfile.create({
        data: { id: PRIMARY_DOCTOR_ID, slug: await availableSlug(transaction, profile.name), isPublished: true, ...profile },
      });
    await replaceSchedules(transaction, PRIMARY_DOCTOR_ID, schedules);
    return saved;
  });
  if (!saved) {
    return NextResponse.json({ error: "The updated availability conflicts with a confirmed appointment. Reschedule or cancel that appointment first." }, { status: 409 });
  }
  const doctor = saved;
  await writeAuditEvent(request, access.session.user.id, "UPDATE", "DoctorProfile", doctor.id);
  invalidatePublicCache(publicCacheTags.clinic);
  invalidatePublicCache(publicCacheTags.doctors);
  return NextResponse.json({ doctor });
}
