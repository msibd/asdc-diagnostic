import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { authorize } from "@/lib/admin-session";
import { apiError, isPrismaError, parseBody, parseQuery } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { invalidatePublicCache, publicCacheTags } from "@/lib/public-cache";
import { doctorInputSchema, doctorListQuerySchema } from "@/modules/doctors/doctor-schema";
import { adminDoctorSelect, availableSlug, replaceSchedules, serializeDoctor } from "@/modules/doctors/doctor-service";

export async function GET(request: Request) {
  const access = await authorize(request.headers, "doctor:read");
  if (!access.session) return apiError(access.error, access.status);
  const query = parseQuery(request, doctorListQuerySchema, "Invalid doctor search.");
  if (!query.ok) return query.response;
  const { search, status, specialization, page, pageSize } = query.data;

  const where: Prisma.DoctorProfileWhereInput = {
    ...(search ? {
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { specialization: { contains: search, mode: "insensitive" } },
        { designation: { contains: search, mode: "insensitive" } },
      ],
    } : {}),
    ...(specialization ? { specialization: { equals: specialization, mode: "insensitive" } } : {}),
    ...(status === "active" ? { isActive: true } : {}),
    ...(status === "inactive" ? { isActive: false } : {}),
    ...(status === "published" ? { isPublished: true } : {}),
    ...(status === "unpublished" ? { isPublished: false } : {}),
  };

  const [total, doctors, specializations] = await Promise.all([
    prisma.doctorProfile.count({ where }),
    prisma.doctorProfile.findMany({
      where,
      select: adminDoctorSelect,
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    // For the filter drop-down; independent of the current search so the choices do not vanish.
    prisma.doctorProfile.findMany({ distinct: ["specialization"], select: { specialization: true }, orderBy: { specialization: "asc" } }),
  ]);

  return NextResponse.json({
    doctors: doctors.map(serializeDoctor),
    total,
    page,
    pageSize,
    specializations: specializations.map((row) => row.specialization),
  });
}

export async function POST(request: Request) {
  const access = await authorize(request.headers, "doctor:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, doctorInputSchema, "Invalid doctor profile.");
  if (!body.ok) return body.response;
  const { schedules, slug: requestedSlug, ...profile } = body.data;

  try {
    const created = await prisma.$transaction(async (transaction) => {
      if (requestedSlug && await transaction.doctorProfile.findUnique({ where: { slug: requestedSlug }, select: { id: true } })) {
        return null;
      }
      const slug = requestedSlug ?? await availableSlug(transaction, profile.name);
      const doctor = await transaction.doctorProfile.create({
        data: { id: randomUUID().replaceAll("-", ""), slug, ...profile },
        select: { id: true },
      });
      await replaceSchedules(transaction, doctor.id, schedules);
      await writeAuditEvent(request, access.session.user.id, "CREATE", "DoctorProfile", doctor.id, {
        name: profile.name, slug, isPublished: profile.isPublished,
      }, transaction);
      return transaction.doctorProfile.findUniqueOrThrow({ where: { id: doctor.id }, select: adminDoctorSelect });
    });
    if (!created) return apiError("This slug is already used by another doctor. Choose a different one.", 409);
    invalidatePublicCache(publicCacheTags.doctors);
    invalidatePublicCache(publicCacheTags.clinic);
    return NextResponse.json({ doctor: serializeDoctor(created) }, { status: 201 });
  } catch (error) {
    // Two requests claimed the same slug at the same moment.
    if (isPrismaError(error, "P2002")) return apiError("This slug is already used by another doctor. Choose a different one.", 409);
    throw error;
  }
}
