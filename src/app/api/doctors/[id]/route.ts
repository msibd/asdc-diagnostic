import { NextResponse } from "next/server";
import { authorize } from "@/lib/admin-session";
import { apiError, isPrismaError, parseBody } from "@/lib/api";
import { writeAuditEvent } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { invalidatePublicCache, publicCacheTags } from "@/lib/public-cache";
import { PRIMARY_DOCTOR_ID, doctorUpdateSchema } from "@/modules/doctors/doctor-schema";
import { adminDoctorSelect, type AdminDoctorRow, replaceSchedules, newlyStrandedBookings, serializeDoctor, strandedMessage } from "@/modules/doctors/doctor-service";

type Context = { params: Promise<{ id: string }> };
type Outcome = { error: string; status: 404 | 409; doctor?: undefined } | { error?: undefined; status?: undefined; doctor: AdminDoctorRow };

function refreshPublicPages() {
  invalidatePublicCache(publicCacheTags.doctors);
  invalidatePublicCache(publicCacheTags.clinic);
}

export async function GET(request: Request, { params }: Context) {
  const access = await authorize(request.headers, "doctor:read");
  if (!access.session) return apiError(access.error, access.status);
  const { id } = await params;
  const doctor = await prisma.doctorProfile.findUnique({ where: { id }, select: adminDoctorSelect });
  if (!doctor) return apiError("Doctor not found.", 404);
  return NextResponse.json({ doctor: serializeDoctor(doctor) });
}

export async function PATCH(request: Request, { params }: Context) {
  const access = await authorize(request.headers, "doctor:write");
  if (!access.session) return apiError(access.error, access.status);
  const body = await parseBody(request, doctorUpdateSchema, "Invalid doctor profile.");
  if (!body.ok) return body.response;
  const { id } = await params;
  const { schedules, slug, ...changes } = body.data;

  try {
    const result: Outcome = await prisma.$transaction(async (transaction): Promise<Outcome> => {
      // The booking code takes this lock too, so a schedule change cannot race a new booking.
      if (schedules && id === PRIMARY_DOCTOR_ID) await transaction.$executeRaw`SELECT pg_advisory_xact_lock(41680271)`;
      const existing = await transaction.doctorProfile.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return { error: "Doctor not found.", status: 404 };
      if (slug && await transaction.doctorProfile.findFirst({ where: { slug, NOT: { id } }, select: { id: true } })) {
        return { error: "This slug is already used by another doctor. Choose a different one.", status: 409 };
      }
      // Only the primary doctor's weekly hours decide when patients can book.
      const stranded = schedules && id === PRIMARY_DOCTOR_ID ? await newlyStrandedBookings(transaction, id, schedules) : [];
      if (stranded.length) return { error: strandedMessage(stranded), status: 409 };
      await transaction.doctorProfile.update({ where: { id }, data: { ...changes, ...(slug ? { slug } : {}) } });
      if (schedules) await replaceSchedules(transaction, id, schedules);
      await writeAuditEvent(request, access.session.user.id, "UPDATE", "DoctorProfile", id, {
        fields: [...Object.keys(changes), ...(slug ? ["slug"] : []), ...(schedules ? ["schedules"] : [])].join(","),
      }, transaction);
      return { doctor: await transaction.doctorProfile.findUniqueOrThrow({ where: { id }, select: adminDoctorSelect }) };
    });
    if (result.error !== undefined) return apiError(result.error, result.status);
    refreshPublicPages();
    return NextResponse.json({ doctor: serializeDoctor(result.doctor) });
  } catch (error) {
    if (isPrismaError(error, "P2002")) return apiError("This slug is already used by another doctor. Choose a different one.", 409);
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const access = await authorize(request.headers, "doctor:write");
  if (!access.session) return apiError(access.error, access.status);
  const { id } = await params;
  // The primary profile supplies the booking hours and the report letterhead: hide it instead.
  if (id === PRIMARY_DOCTOR_ID) {
    return apiError("This profile provides the clinic's booking hours and report letterhead, so it cannot be deleted. Deactivate or unpublish it instead.", 409);
  }
  try {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.doctorProfile.findUnique({ where: { id }, select: { name: true, slug: true } });
      if (!existing) throw Object.assign(new Error("not found"), { code: "P2025" });
      // Schedules are removed with the doctor (cascade).
      await transaction.doctorProfile.delete({ where: { id } });
      await writeAuditEvent(request, access.session.user.id, "DELETE", "DoctorProfile", id, { name: existing.name, slug: existing.slug }, transaction);
    });
  } catch (error) {
    if (isPrismaError(error, "P2025")) return apiError("Doctor not found.", 404);
    throw error;
  }
  refreshPublicPages();
  return NextResponse.json({ success: true });
}
