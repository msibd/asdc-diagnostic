import type { AppointmentStatus } from "@/generated/prisma/client";
import { addClinicDays, getClinicDateKey } from "@/lib/clinic-date";
import { prisma } from "@/lib/prisma";
import { nextPatientCode } from "@/modules/patients/services/patient-service";
import type { CreateAppointmentInput } from "@/modules/appointments/schemas/appointment-schema";

export class AppointmentConflictError extends Error {
  /** A machine-readable reason, so the public site can word the message in the visitor's language. */
  constructor(message: string, readonly code: "CONFLICT" | "DUPLICATE_REQUEST" | "SLOT_TAKEN" = "CONFLICT") {
    super(message);
    this.name = "AppointmentConflictError";
  }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const ACTIVE = ["PENDING", "CONFIRMED"] as const;

/** One form of a phone number for comparing: "+880 1712-345678" and "01712345678" match. */
export function phoneKey(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length === 13) return `0${digits.slice(3)}`;
  return digits;
}

const clinicTimeLabel = (date: Date) =>
  new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Dhaka" }).format(date);

/**
 * The same person cannot hold two active bookings for the same service on the same day, nor two
 * bookings at overlapping times (they cannot be in two chairs). This catches a double-clicked form,
 * a request sent twice, and staff booking someone who already asked online.
 */
async function assertNotDuplicate(transaction: Tx, phone: string, service: string, start: Date, durationMinutes: number) {
  const key = phoneKey(phone);
  if (!key) return;
  const day = getClinicDateKey(start);
  const sameDay = await transaction.appointment.findMany({
    where: {
      status: { in: [...ACTIVE] },
      dateTime: { gte: new Date(`${day}T00:00:00+06:00`), lt: new Date(`${addClinicDays(day, 1)}T00:00:00+06:00`) },
    },
    select: { patientPhone: true, service: true, dateTime: true, durationMinutes: true },
  });
  const end = start.getTime() + durationMinutes * 60_000;
  for (const existing of sameDay) {
    if (phoneKey(existing.patientPhone) !== key) continue;
    const existingStart = existing.dateTime.getTime();
    const overlaps = start.getTime() < existingStart + existing.durationMinutes * 60_000 && existingStart < end;
    if (existing.service === service || overlaps) {
      throw new AppointmentConflictError(
        `This mobile number already has a ${existing.service} appointment on this day at ${clinicTimeLabel(existing.dateTime)}. Ask the clinic to change it instead of booking again.`,
        "DUPLICATE_REQUEST",
      );
    }
  }
}

/** For bookings from the website, a time someone else has already requested counts as taken. */
async function assertSlotFree(transaction: Tx, start: Date, durationMinutes: number) {
  const end = start.getTime() + durationMinutes * 60_000;
  const nearby = await transaction.appointment.findMany({
    where: { status: { in: [...ACTIVE] }, dateTime: { gte: new Date(start.getTime() - 24 * 60 * 60_000), lt: new Date(end) } },
    select: { dateTime: true, durationMinutes: true },
  });
  if (nearby.some((item) => start.getTime() < item.dateTime.getTime() + item.durationMinutes * 60_000 && item.dateTime.getTime() < end)) {
    throw new AppointmentConflictError("This time has just been taken. Choose another time.", "SLOT_TAKEN");
  }
}

/**
 * Booked times on one clinic day, for the public booking form. Times only: nothing about who
 * booked, or for what.
 */
export async function listBusyTimes(day: string) {
  const rows = await prisma.appointment.findMany({
    where: {
      status: { in: [...ACTIVE] },
      dateTime: { gte: new Date(`${day}T00:00:00+06:00`), lt: new Date(`${addClinicDays(day, 1)}T00:00:00+06:00`) },
    },
    select: { dateTime: true, durationMinutes: true },
    orderBy: { dateTime: "asc" },
    take: 200,
  });
  const hhmm = (date: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Dhaka" }).format(date);
  return rows.map((row) => ({ start: hhmm(row.dateTime), end: hhmm(new Date(row.dateTime.getTime() + row.durationMinutes * 60_000)) }));
}

function getClinicTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dhaka",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(values.weekday);
  return { weekday, time: `${values.hour}:${values.minute}` };
}

async function validateSchedule(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  dateTime: Date,
  durationMinutes: number,
  excludeId?: string,
  // A walk-in is seen now, whatever else is booked; only the doctor's working hours still apply.
  checkOverlap = true,
  // Staff may book any time. Only requests from the public website must fall inside the doctor's hours.
  checkHours = true,
) {
  const { weekday, time } = getClinicTime(dateTime);
  const schedules = await transaction.doctorSchedule.findMany({
    where: { doctorId: "primary" },
  });
  if (checkHours && schedules.length) {
    const schedule = schedules.find((item) => item.dayOfWeek === weekday);
    if (!schedule?.isWorking) {
      return "The doctor is not available on the selected day.";
    }
    const [hour, minute] = time.split(":").map(Number);
    const [endHour, endMinute] = schedule.endTime.split(":").map(Number);
    const requestedEnd = hour * 60 + minute + durationMinutes;
    if (time < schedule.startTime || requestedEnd > endHour * 60 + endMinute) {
      return `The appointment must fit within the doctor's hours (${schedule.startTime}–${schedule.endTime}).`;
    }
  }

  if (!checkOverlap) return null;
  const serviceDay = 24 * 60;
  const slotStart = dateTime.getTime();
  const slotEnd = slotStart + durationMinutes * 60_000;
  const nearby = await transaction.appointment.findMany({
    where: {
      status: "CONFIRMED",
      ...(excludeId ? { id: { not: excludeId } } : {}),
      dateTime: {
        gte: new Date(slotStart - serviceDay * 60_000),
        lt: new Date(slotEnd),
      },
    },
    select: { dateTime: true, durationMinutes: true, patientName: true },
  });
  if (nearby.some((item) => {
    const existingStart = item.dateTime.getTime();
    const existingEnd = existingStart + item.durationMinutes * 60_000;
    return slotStart < existingEnd && existingStart < slotEnd;
  })) {
    return "This time overlaps a confirmed appointment. Choose another time.";
  }
  return null;
}

/** The doctor for a visit: the one chosen (must be active), or the clinic's main doctor when none is chosen. */
async function resolveDoctorId(transaction: Tx, requested: string | null | undefined) {
  if (requested) {
    const doctor = await transaction.doctorProfile.findFirst({ where: { id: requested, isActive: true }, select: { id: true } });
    if (!doctor) throw new AppointmentConflictError("Select an active doctor.");
    return doctor.id;
  }
  const main = await transaction.doctorProfile.findUnique({ where: { id: "primary" }, select: { id: true } });
  return main?.id ?? null;
}

export async function createAppointment(
  data: CreateAppointmentInput,
  // walkIn: seen now, no overlap check. fromWebsite: a time anyone has requested counts as taken.
  options: { walkIn?: boolean; fromWebsite?: boolean } = {},
) {
  return prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(41680271)`;
    const patient = data.patientId
      ? await transaction.patient.findUnique({ where: { id: data.patientId } })
      : null;
    if (data.patientId && (!patient || !patient.isActive)) {
      throw new AppointmentConflictError("Select an active patient or leave the patient unlinked.");
    }
    const service = await transaction.clinicService.findFirst({
      where: { name: data.service, isActive: true },
      select: { id: true, durationMinutes: true },
    });
    const durationMinutes = service?.durationMinutes ?? 30;
    const doctorId = await resolveDoctorId(transaction, data.doctorId);
    const scheduleError = await validateSchedule(transaction, data.dateTime, durationMinutes, undefined, !options.walkIn, Boolean(options.fromWebsite));
    if (scheduleError) throw new AppointmentConflictError(scheduleError);
    // Runs under the advisory lock above, so two identical requests cannot both pass the check.
    await assertNotDuplicate(transaction, patient?.phone ?? data.patientPhone, data.service, data.dateTime, durationMinutes);
    if (options.fromWebsite) await assertSlotFree(transaction, data.dateTime, durationMinutes);
    return transaction.appointment.create({
      data: {
        ...data,
        // A walk-in is already at the clinic, so it starts confirmed.
        ...(options.walkIn ? { source: "WALK_IN" as const, status: "CONFIRMED" as const } : {}),
        patientName: patient?.name ?? data.patientName,
        patientPhone: patient?.phone ?? data.patientPhone,
        patientEmail: patient?.email ?? data.patientEmail,
        durationMinutes,
        serviceId: service?.id ?? null,
        doctorId,
      },
    });
  });
}

/**
 * The patient a finished visit belongs to: the existing record with the same name and mobile number
 * (the mobile written any common way), or a new one with the next patient ID. The same person is
 * never registered twice; a different person on a shared number gets their own record.
 */
async function patientForVisit(transaction: Tx, visit: { patientName: string; patientPhone: string; patientEmail: string | null }) {
  const name = visit.patientName.trim();
  const key = phoneKey(visit.patientPhone);
  const phones = [...new Set([visit.patientPhone.trim(), key, `88${key}`, `+88${key}`])];
  const existing = await transaction.patient.findFirst({
    where: { phone: { in: phones }, name: { equals: name, mode: "insensitive" } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing.id;
  const created = await transaction.patient.create({
    data: { name, phone: visit.patientPhone.trim(), email: visit.patientEmail, patientCode: await nextPatientCode(transaction) },
    select: { id: true },
  });
  return created.id;
}

export async function updateAppointmentStatus(id: string, status: AppointmentStatus) {
  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(41680271)`;
      const current = await transaction.appointment.findUnique({ where: { id } });
      if (!current) return null;
      const allowedNextStatuses: Record<AppointmentStatus, AppointmentStatus[]> = {
        PENDING: ["CONFIRMED", "CANCELLED", "NO_SHOW"],
        CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
        COMPLETED: [],
        CANCELLED: [],
        // A patient marked no-show by mistake can be put back to confirmed.
        NO_SHOW: ["CONFIRMED"],
      };
      if (current.status !== status && !allowedNextStatuses[current.status].includes(status)) {
        throw new AppointmentConflictError(`Cannot change an appointment from ${current.status.toLowerCase()} to ${status.toLowerCase()}.`);
      }
      if (status === "CONFIRMED") {
        const scheduleError = await validateSchedule(transaction, current.dateTime, current.durationMinutes, id, true, false);
        if (scheduleError) throw new AppointmentConflictError(scheduleError);
      }
      // A visit that is completed belongs to a registered patient: link one, or register them now.
      const patientId = status === "COMPLETED" && !current.patientId ? await patientForVisit(transaction, current) : undefined;
      return transaction.appointment.update({ where: { id }, data: { status, ...(patientId ? { patientId } : {}) } });
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return null;
    }

    throw error;
  }
}

export async function updateAppointment(
  id: string,
  data: CreateAppointmentInput,
) {
  try {
    return await prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(41680271)`;
      const current = await transaction.appointment.findUnique({ where: { id } });
      if (!current) return null;
      // Finished visits are clinical history; rebooking a cancelled one means creating a new appointment.
      if (current.status === "COMPLETED" || current.status === "CANCELLED" || current.status === "NO_SHOW") {
        const label = current.status === "COMPLETED" ? "Completed" : current.status === "CANCELLED" ? "Cancelled" : "No-show";
        throw new AppointmentConflictError(`${label} appointments cannot be edited. Create a new appointment instead.`);
      }
      const patient = data.patientId
        ? await transaction.patient.findUnique({ where: { id: data.patientId } })
        : null;
      if (data.patientId && (!patient || !patient.isActive)) {
        throw new AppointmentConflictError("Select an active patient or leave the patient unlinked.");
      }
      const service = await transaction.clinicService.findFirst({
        where: { name: data.service, isActive: true },
        select: { id: true, durationMinutes: true },
      });
      const durationMinutes = service?.durationMinutes ?? current.durationMinutes;
      const scheduleError = await validateSchedule(transaction, data.dateTime, durationMinutes, id, true, false);
      if (scheduleError) throw new AppointmentConflictError(scheduleError);
      return transaction.appointment.update({
        where: { id },
        data: {
          ...data,
          patientName: patient?.name ?? data.patientName,
          patientPhone: patient?.phone ?? data.patientPhone,
          patientEmail: patient?.email ?? data.patientEmail,
          durationMinutes,
          serviceId: service?.id ?? null,
          doctorId: data.doctorId === undefined ? undefined : await resolveDoctorId(transaction, data.doctorId),
        },
      });
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return null;
    }

    throw error;
  }
}

export async function deleteAppointment(id: string) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const appointment = await transaction.appointment.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!appointment) return null;
      if (appointment.status !== "PENDING" && appointment.status !== "CANCELLED") return false;
      await transaction.appointment.delete({ where: { id } });
      return true;
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return false;
    }

    throw error;
  }
}
