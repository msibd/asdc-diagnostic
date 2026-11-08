import { Prisma } from "@/generated/prisma/client";
import type { prisma } from "@/lib/prisma";
import { slugify, type DoctorRecord } from "./doctor-schema";

// Server-side helpers for the doctor directory. A transaction client or the global client both work.
type Db = Pick<typeof prisma, "doctorProfile" | "doctorSchedule" | "appointment">;

/** Everything the admin screens need; never used for public pages (see publicDoctorSelect). */
export const adminDoctorSelect = {
  id: true,
  name: true,
  slug: true,
  designation: true,
  imageUrl: true,
  qualifications: true,
  specialization: true,
  experienceYears: true,
  bio: true,
  registrationNumber: true,
  consultationInfo: true,
  consultationFee: true,
  phone: true,
  email: true,
  address: true,
  displayOrder: true,
  isActive: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
  schedules: {
    orderBy: { dayOfWeek: "asc" },
    select: { dayOfWeek: true, startTime: true, endTime: true, isWorking: true },
  },
} satisfies Prisma.DoctorProfileSelect;

export type AdminDoctorRow = Prisma.DoctorProfileGetPayload<{ select: typeof adminDoctorSelect }>;

export function serializeDoctor(row: AdminDoctorRow): DoctorRecord {
  return {
    ...row,
    consultationFee: row.consultationFee.toString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** A free slug: the wanted one, or the wanted one with -2, -3… when it is taken by another doctor. */
export async function availableSlug(db: Pick<Db, "doctorProfile">, wanted: string, excludeId?: string) {
  const base = slugify(wanted);
  for (let attempt = 1; attempt < 200; attempt += 1) {
    const candidate = attempt === 1 ? base : `${base.slice(0, 76)}-${attempt}`;
    const taken = await db.doctorProfile.findFirst({
      where: { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
  throw new Error("Unable to find a free slug.");
}

type ScheduleInput = { dayOfWeek: number; startTime: string; endTime: string; isWorking: boolean };

const weekdayShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dhakaParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dhakaLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" });

/** Whether a booking of this length starting at this time fits inside the given weekly schedule. */
function fits(schedules: ReadonlyMap<number, ScheduleInput>, appointment: { dateTime: Date; durationMinutes: number }) {
  const values = Object.fromEntries(dhakaParts.formatToParts(appointment.dateTime).map(({ type, value }) => [type, value]));
  const schedule = schedules.get(weekdayShort.indexOf(values.weekday));
  if (!schedule?.isWorking) return false;
  const start = Number(values.hour) * 60 + Number(values.minute);
  const [endHour, endMinute] = schedule.endTime.split(":").map(Number);
  return `${values.hour}:${values.minute}` >= schedule.startTime && start + appointment.durationMinutes <= endHour * 60 + endMinute;
}

/**
 * The upcoming confirmed appointments that a new weekly schedule would strand: they fit the hours
 * saved today but not the new ones. A booking that is already outside the saved hours is not the
 * edit's fault, so it never blocks a save that does not change those hours. Only the primary
 * doctor's schedule decides bookings, so only that doctor needs this check.
 */
export async function newlyStrandedBookings(db: Pick<Db, "appointment" | "doctorSchedule">, doctorId: string, schedules: readonly ScheduleInput[]) {
  const [saved, confirmed] = await Promise.all([
    db.doctorSchedule.findMany({ where: { doctorId }, select: { dayOfWeek: true, startTime: true, endTime: true, isWorking: true } }),
    db.appointment.findMany({ where: { status: "CONFIRMED", dateTime: { gte: new Date() } }, select: { dateTime: true, durationMinutes: true }, orderBy: { dateTime: "asc" } }),
  ]);
  const current = new Map(saved.map((schedule) => [schedule.dayOfWeek, schedule]));
  const next = new Map(schedules.map((schedule) => [schedule.dayOfWeek, schedule]));
  return confirmed.filter((appointment) => fits(current, appointment) && !fits(next, appointment));
}

/** "…conflicts with 2 confirmed appointments (first: 10 Nov 2026, 10:00)…" */
export function strandedMessage(stranded: readonly { dateTime: Date }[]) {
  const count = stranded.length;
  return `The new hours would leave ${count} confirmed appointment${count === 1 ? "" : "s"} outside the working hours (first: ${dhakaLabel.format(stranded[0].dateTime)}). Reschedule or cancel ${count === 1 ? "it" : "them"} first.`;
}

export async function replaceSchedules(db: Pick<Db, "doctorSchedule">, doctorId: string, schedules: readonly ScheduleInput[]) {
  for (const schedule of schedules) {
    await db.doctorSchedule.upsert({
      where: { doctorId_dayOfWeek: { doctorId, dayOfWeek: schedule.dayOfWeek } },
      create: { ...schedule, doctorId },
      update: schedule,
    });
  }
}
